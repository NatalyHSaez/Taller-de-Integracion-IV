/* global projectRequire, __dirname */
/** Notificaciones internas: rutas, paginación, marcado (204), persistencia, detalle y errores. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const { installFakes, apiError } = require('./support/fakes.cjs');

const fakes = installFakes();
const { createNotificationsStore, classifyNotificationError, mergeNotifications } =
  projectRequire('src/modules/notifications/application/notifications.ts');
const { backendNotificationsApi } = projectRequire('src/modules/notifications/infrastructure/notifications-api.ts');
const { Colors } = projectRequire('src/shared/presentation/theme.ts');
const { NotificationItem, NotificationsEmpty, NotificationDetailView, INTERNAL_NOTICE } =
  projectRequire('src/modules/notifications/presentation/components/notifications-view.tsx');

const theme = Colors.light;
const NOW = new Date('2026-11-06T12:00:00.000Z');
const at = (minutesAgo) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
const notif = (id, status, minutesAgo) => ({
  id, type: 'CLINICAL_ALERT', title: `Título ${id}`, body: `Cuerpo ${id}`, status, createdAt: at(minutesAgo), readAt: null,
});

/** Backend simulado con la lógica de notificaciones/rutas.py (persiste el estado). */
function fakeBackend(rows) {
  const db = rows.map((r) => ({ ...r }));
  const calls = { list: [], markRead: [] };
  return {
    calls,
    db,
    async list({ page, size, status }) {
      calls.list.push({ page, size, status });
      const filtered = db.filter((n) => !status || n.status === status).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return { total: filtered.length, page, size, items: filtered.slice((page - 1) * size, page * size).map((n) => ({ ...n })) };
    },
    async markRead(id) {
      calls.markRead.push(id);
      const row = db.find((n) => n.id === id);
      if (!row) throw apiError('NOTIFICATION_NOT_FOUND', 404);
      row.status = 'read';
      row.readAt = NOW.toISOString();
    },
  };
}

const seven = (status = 'sent') => Array.from({ length: 7 }, (_, i) => notif(`n${i + 1}`, status, (i + 1) * 10));

test('rutas reales en inglés: GET /notifications con page, size y status; POST .../read', async () => {
  fakes.calls.get.length = 0;
  fakes.calls.post.length = 0;
  fakes.replyGet({ total: 1, page: 2, size: 5, items: [notif('a', 'pending', 1)] });
  const page = await backendNotificationsApi.list({ page: 2, size: 5, status: 'pending' });
  assert.equal(fakes.calls.get[0].path, '/notifications');
  assert.deepEqual(fakes.calls.get[0].options.query, { page: 2, size: 5, status: 'pending' });
  assert.equal(page.items[0].id, 'a');

  fakes.replyPost(() => undefined); // 204
  await backendNotificationsApi.markRead('a b');
  assert.equal(fakes.calls.post[0].path, '/notifications/a%20b/read');
});

test('la paginación recorre todo sin duplicar', async () => {
  const backend = fakeBackend(seven());
  const store = createNotificationsStore({ pageSize: 3, now: () => NOW });
  await store.setOwner('u1', backend);
  await store.loadMore();
  // Llega una nueva arriba mientras se recorre: desplaza las páginas.
  backend.db.push(notif('nueva', 'sent', 0));
  await store.loadMore();
  await store.loadMore();
  const ids = store.getState().items.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, 'sin duplicados');
  for (const id of ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7']) assert.ok(ids.includes(id), `falta ${id}`);
});

test('marcar dentro del filtro "Enviadas" no hace saltarse la siguiente página', async () => {
  const backend = fakeBackend(seven('sent'));
  const store = createNotificationsStore({ pageSize: 3, now: () => NOW });
  await store.setOwner('u1', backend);
  await store.setFilter('sent');
  await store.markRead('n1'); // sale del filtro en el backend
  await store.loadMore();
  await store.loadMore();
  const ids = store.getState().items.map((n) => n.id);
  assert.deepEqual(ids, ['n2', 'n3', 'n4', 'n5', 'n6', 'n7']);
  assert.equal(store.getState().hasMore, false);
});

test('marcar como leída: una sola llamada, 204, actualiza lista y detalle, y persiste', async () => {
  const backend = fakeBackend(seven('pending'));
  const store = createNotificationsStore({ pageSize: 10, now: () => NOW });
  await store.setOwner('u1', backend);
  const listCalls = backend.calls.list.length;

  await Promise.all([store.markRead('n2'), store.markRead('n2')]);
  assert.deepEqual(backend.calls.markRead, ['n2']);
  assert.equal(store.getState().items.find((n) => n.id === 'n2').status, 'read');
  assert.equal(store.get('n2').status, 'read', 'el detalle (caché) también se actualiza');
  assert.equal(backend.calls.list.length, listCalls, 'no se recarga');

  await store.markRead('n2');
  assert.equal(backend.calls.markRead.length, 1, 'ya leída: no se vuelve a enviar');

  await store.refresh();
  assert.equal(store.getState().items.find((n) => n.id === 'n2').status, 'read', 'persiste al volver a consultar');
});

test('el detalle usa la caché de la lista y desaparece al cambiar de usuario', async () => {
  const backend = fakeBackend(seven());
  const store = createNotificationsStore({ pageSize: 10, now: () => NOW });
  await store.setOwner('u1', backend);
  assert.equal(store.get('n3').title, 'Título n3');
  const calls = backend.calls.list.length;
  store.get('n3');
  assert.equal(backend.calls.list.length, calls, 'no hay GET individual');

  await store.setOwner('u2', fakeBackend([]));
  assert.equal(store.get('n3'), null);
  assert.deepEqual(store.getState().items, []);
});

test('errores: 401, 403, 404 al marcar y red con reintento; sin datos simulados', async () => {
  assert.equal(classifyNotificationError(apiError('AUTHENTICATION_REQUIRED', 401)).kind, 'session');
  assert.equal(classifyNotificationError(apiError('FORBIDDEN', 403)).kind, 'forbidden');
  assert.equal(classifyNotificationError(apiError('NOTIFICATION_NOT_FOUND', 404)).kind, 'not_found');
  assert.equal(classifyNotificationError(new TypeError('Network request failed')).kind, 'network');

  let fail = true;
  const backend = fakeBackend(seven());
  const flaky = { list: (q) => (fail ? Promise.reject(new TypeError('Network request failed')) : backend.list(q)), markRead: backend.markRead };
  const store = createNotificationsStore({ pageSize: 10, now: () => NOW });
  await store.setOwner('u1', flaky);
  assert.equal(store.getState().error.kind, 'network');
  assert.deepEqual(store.getState().items, [], 'sin respaldo a mocks');
  fail = false;
  await store.refresh();
  assert.equal(store.getState().items.length, 7);

  backend.db.splice(0, 1); // n1 ya no existe
  await store.markRead('n1');
  assert.equal(store.getState().markError.kind, 'not_found');
  assert.ok(!store.getState().items.some((n) => n.id === 'n1'));
});

test('mergeNotifications descarta repetidos y ordena por fecha', () => {
  const merged = mergeNotifications([notif('a', 'sent', 5)], [notif('a', 'sent', 5), notif('b', 'sent', 1)]);
  assert.deepEqual(merged.map((n) => n.id), ['b', 'a']);
});

const text = (el) => renderToStaticMarkup(el).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const base = {
  ownerId: 'u1', filter: 'all', items: [], total: 0, hasMore: false, loaded: true, loading: false,
  refreshing: false, loadingMore: false, error: null, loadMoreError: null, marking: [], markError: null,
};

test('vista: estados, aviso de notificaciones internas y detalle', () => {
  assert.match(text(NotificationsEmpty({ state: { ...base, loading: true, loaded: false }, theme, onRetry() {} })), /Cargando notificaciones/);
  assert.match(text(NotificationsEmpty({ state: base, theme, onRetry() {} })), /No tienes notificaciones/);
  const network = text(NotificationsEmpty({ state: { ...base, loaded: false, error: classifyNotificationError(new TypeError('x')) }, theme, onRetry() {} }));
  assert.match(network, /Reintentar/);
  const session = text(NotificationsEmpty({ state: { ...base, loaded: false, error: classifyNotificationError(apiError('X', 401)) }, theme, onRetry() {} }));
  assert.match(session, /sesión expiró/);
  assert.doesNotMatch(session, /Reintentar/);

  let opened = null;
  const item = NotificationItem({ notification: notif('n1', 'sent', 3), marking: false, theme, onOpen: (id) => { opened = id; }, onMarkRead() {} });
  assert.match(text(item), /Título n1/);
  assert.match(text(item), /Marcar como leída/);
  // La tarjeta y el botón "Marcar como leída" son hermanos, no anidados.
  const [content, mark] = item.props.children;
  assert.ok(mark, 'botón de marcar fuera del área de abrir');
  content.props.onPress();
  assert.equal(opened, 'n1');

  const detail = text(NotificationDetailView({ notification: { ...notif('n2', 'read', 3), readAt: NOW.toISOString() }, marking: false, error: null, theme, onMarkRead() {} }));
  assert.match(detail, /Leída/);
  assert.match(detail, /Alerta clínica/);
  assert.ok(detail.includes(INTERNAL_NOTICE.replace(/\s+/g, ' ')));
  assert.match(INTERNAL_NOTICE, /No se envían como notificaciones push/);
});

test('la app ya no usa la ruta en español /notificaciones del backend', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const read = (layer, file) =>
    fs.readFileSync(path.resolve(__dirname, '..', 'src', 'modules', 'notifications', layer, file), 'utf8');
  for (const source of [read('application', 'notifications.ts'), read('infrastructure', 'notifications-api.ts')]) {
    assert.doesNotMatch(source, /['"`]\/notificaciones/);
    assert.doesNotMatch(source, /mockApi|MOCK_/);
  }
  assert.match(read('infrastructure', 'notifications-api.ts'), /['"`]\/notifications['"`]/);
});
