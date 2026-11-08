/* global projectRequire, __dirname */
/** Alertas: lista y filtros reales, contadores, marcar como leída, errores y vista. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const { installFakes, apiError } = require('./support/fakes.cjs');

const fakes = installFakes();
const { createPatientAlerts, classifyAlertError } = projectRequire('src/modules/evaluation/application/patient-alerts.ts');
const { backendAlertsService } = projectRequire('src/modules/evaluation/infrastructure/alerts-api.ts');
const { Colors } = projectRequire('src/shared/presentation/theme.ts');
const { AlertCard, AlertDetail, AlertFilters, AlertsEmpty } = projectRequire('src/modules/evaluation/presentation/components/alerts-view.tsx');

const theme = Colors.light;
const NOW = new Date('2026-11-06T12:00:00.000Z');
const alert = (id, status, createdAt, severity = 'ALTA') => ({
  id,
  readingId: `r-${id}`,
  ruleCode: 'HTA_ALERT',
  severity,
  explanation: `Explicación ${id}`,
  status,
  createdAt,
  readAt: status === 'READ' ? createdAt : null,
});

/** Servicio simulado con la lógica de evaluacion/rutas.py. */
function fakeService(initial) {
  const db = { alerts: initial.map((a) => ({ ...a })) };
  const calls = { list: [], markRead: [] };
  return {
    calls,
    db,
    list: async (patientId, status) => {
      calls.list.push({ patientId, status });
      return db.alerts
        .filter((a) => !status || a.status === status)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map((a) => ({ ...a }));
    },
    markRead: async (patientId, alertId) => {
      calls.markRead.push({ patientId, alertId });
      const found = db.alerts.find((a) => a.id === alertId);
      if (!found) throw apiError('ALERT_NOT_FOUND', 404);
      found.status = 'READ';
      return undefined; // 204 sin cuerpo
    },
  };
}

const DATA = [
  alert('a1', 'OPEN', '2026-11-05T10:00:00Z'),
  alert('a2', 'READ', '2026-11-04T10:00:00Z', 'MEDIA'),
  alert('a3', 'OPEN', '2026-11-06T09:00:00Z', 'BAJA'),
];

test('rutas reales: GET con status opcional y POST .../read', async () => {
  fakes.calls.get.length = 0;
  fakes.calls.post.length = 0;
  fakes.replyGet([{ ...DATA[0], status: 'OPEN' }]);
  const items = await backendAlertsService.list('p 1', 'OPEN');
  assert.equal(fakes.calls.get[0].path, '/patients/p%201/alerts');
  assert.deepEqual(fakes.calls.get[0].options.query, { status: 'OPEN' });
  assert.equal(items[0].id, 'a1');

  fakes.replyPost(() => undefined); // 204 sin cuerpo
  await backendAlertsService.markRead('p 1', 'a 1');
  assert.equal(fakes.calls.post[0].path, '/patients/p%201/alerts/a%201/read');
});

test('contadores y filtros salen del backend', async () => {
  const service = fakeService(DATA);
  const alerts = createPatientAlerts(service, { now: () => NOW });
  await alerts.setPatient('p1');
  let state = alerts.getState();
  assert.deepEqual(state.counts, { all: 3, open: 2, read: 1 });
  assert.deepEqual(state.items.map((a) => a.id), ['a3', 'a1', 'a2']);

  await alerts.setFilter('OPEN');
  state = alerts.getState();
  assert.deepEqual(service.calls.list.at(-1), { patientId: 'p1', status: 'OPEN' });
  assert.deepEqual(state.items.map((a) => a.id), ['a3', 'a1']);

  await alerts.setFilter('READ');
  assert.deepEqual(alerts.getState().items.map((a) => a.id), ['a2']);
});

test('marcar como leída llama una sola vez, procesa 204 y actualiza sin recargar', async () => {
  const service = fakeService(DATA);
  const alerts = createPatientAlerts(service, { now: () => NOW });
  await alerts.setPatient('p1');
  await alerts.setFilter('OPEN');
  const listCalls = service.calls.list.length;

  await Promise.all([alerts.markRead('a1'), alerts.markRead('a1')]);
  assert.deepEqual(service.calls.markRead, [{ patientId: 'p1', alertId: 'a1' }]);
  const state = alerts.getState();
  assert.deepEqual(state.items.map((a) => a.id), ['a3'], 'con filtro "Sin leer" desaparece de la lista');
  assert.deepEqual(state.counts, { all: 3, open: 1, read: 2 });
  assert.equal(service.calls.list.length, listCalls, 'no se recarga la lista');
  assert.deepEqual(state.marking, []);

  await alerts.markRead('a2');
  assert.equal(service.calls.markRead.length, 1, 'una alerta ya leída no se vuelve a enviar');

  // Al actualizar, el backend confirma el cambio.
  await alerts.refresh();
  assert.deepEqual(alerts.getState().counts, { all: 3, open: 1, read: 2 });
});

test('en "Todas" la alerta queda marcada como leída con su fecha', async () => {
  const service = fakeService(DATA);
  const alerts = createPatientAlerts(service, { now: () => NOW });
  await alerts.setPatient('p1');
  await alerts.markRead('a3');
  const a3 = alerts.getState().items.find((a) => a.id === 'a3');
  assert.equal(a3.status, 'READ');
  assert.equal(a3.readAt, NOW.toISOString());
});

test('ALERT_NOT_FOUND quita la alerta y lo explica', async () => {
  const service = fakeService(DATA);
  const alerts = createPatientAlerts(service, { now: () => NOW });
  await alerts.setPatient('p1');
  alerts.open('a1');
  service.db.alerts = service.db.alerts.filter((a) => a.id !== 'a1');
  await alerts.markRead('a1');
  const state = alerts.getState();
  assert.equal(state.markError.kind, 'not_found');
  assert.ok(!state.items.some((a) => a.id === 'a1'));
  assert.equal(state.selectedId, null);
  assert.deepEqual(state.counts, { all: 2, open: 1, read: 1 });
});

test('403 y error de red al listar y al marcar', async () => {
  assert.equal(classifyAlertError(apiError('FORBIDDEN', 403)).kind, 'forbidden');
  assert.equal(classifyAlertError(new TypeError('Network request failed')).kind, 'network');

  let mode = 'forbidden';
  const service = {
    list: async () => {
      if (mode === 'forbidden') throw apiError('FORBIDDEN', 403);
      if (mode === 'network') throw new TypeError('Network request failed');
      return DATA.map((a) => ({ ...a }));
    },
    markRead: async () => { throw new TypeError('Network request failed'); },
  };
  const alerts = createPatientAlerts(service, { now: () => NOW });
  await alerts.setPatient('p1');
  assert.equal(alerts.getState().error.kind, 'forbidden');
  mode = 'network';
  await alerts.refresh();
  assert.equal(alerts.getState().error.kind, 'network');
  mode = 'ok';
  await alerts.refresh();
  assert.equal(alerts.getState().error, null);

  await alerts.markRead('a1');
  const state = alerts.getState();
  assert.equal(state.markError.kind, 'network');
  assert.equal(state.items.find((a) => a.id === 'a1').status, 'OPEN', 'si falla, sigue sin leer');
});

test('el detalle usa los datos de la lista', async () => {
  const service = fakeService(DATA);
  const alerts = createPatientAlerts(service, { now: () => NOW });
  await alerts.setPatient('p1');
  alerts.open('a2');
  assert.equal(alerts.selected().explanation, 'Explicación a2');
  assert.equal(service.calls.list.length, 1, 'abrir el detalle no consulta nada');
});

test('el cambio de paciente limpia la lista y descarta respuestas tardías', async () => {
  const gates = [];
  const service = {
    list: (patientId) => new Promise((resolve) => gates.push(() => resolve([alert(`${patientId}-x`, 'OPEN', '2026-11-06T09:00:00Z')]))),
    markRead: async () => {},
  };
  const alerts = createPatientAlerts(service, { now: () => NOW });
  const first = alerts.setPatient('pia');
  const late = gates.shift();
  const second = alerts.setPatient('rosa');
  assert.deepEqual(alerts.getState().items, []);
  gates.shift()();
  await second;
  late();
  await first;
  assert.deepEqual(alerts.getState().items.map((a) => a.id), ['rosa-x']);
});

const text = (el) => renderToStaticMarkup(el).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const base = {
  patientId: 'p1', filter: 'ALL', items: [], counts: { all: 3, open: 2, read: 1 }, loaded: true,
  loading: false, refreshing: false, error: null, marking: [], markError: null, selectedId: null,
};

test('la vista muestra contadores, severidad, explicación, fecha y estado', () => {
  const filters = text(AlertFilters({ state: base, theme, onFilter() {} }));
  assert.match(filters, /Todas \(3\)/);
  assert.match(filters, /Sin leer \(2\)/);
  assert.match(filters, /Leídas \(1\)/);

  let marked = null;
  const card = AlertCard({ alert: alert('a1', 'OPEN', '2026-11-05T10:00:00Z'), marking: false, theme, onMarkRead: (id) => { marked = id; }, onOpen() {} });
  const cardText = text(card);
  assert.match(cardText, /Severidad alta/);
  assert.match(cardText, /Explicación a1/);
  assert.match(cardText, /Sin leer/);
  assert.match(cardText, /2026/);
  assert.match(cardText, /Marcar como leída/);
  assert.doesNotMatch(text(AlertCard({ alert: alert('a2', 'READ', '2026-11-04T10:00:00Z'), marking: false, theme, onMarkRead() {}, onOpen() {} })), /Marcar como leída/);

  const detail = text(AlertDetail({ alert: alert('a2', 'READ', '2026-11-04T10:00:00Z', 'MEDIA'), marking: false, theme, onMarkRead() {}, onOpenReading() {}, onClose() {} }));
  assert.match(detail, /Severidad media/);
  assert.match(detail, /Leída/);
  assert.match(detail, /HTA_ALERT/);
  assert.match(detail, /Ver la lectura/);
  void marked;
});

test('estados de carga, vacío, error con reintento y acceso denegado', () => {
  assert.match(text(AlertsEmpty({ state: { ...base, loading: true, loaded: false }, theme, onRetry() {} })), /Cargando alertas/);
  assert.match(text(AlertsEmpty({ state: { ...base, filter: 'OPEN' }, theme, onRetry() {} })), /No hay alertas sin leer/);
  const network = text(AlertsEmpty({ state: { ...base, loaded: false, error: classifyAlertError(new TypeError('x')) }, theme, onRetry() {} }));
  assert.match(network, /Reintentar/);
  const forbidden = text(AlertsEmpty({ state: { ...base, loaded: false, error: classifyAlertError(apiError('FORBIDDEN', 403)) }, theme, onRetry() {} }));
  assert.match(forbidden, /Sin acceso a las alertas/);
  assert.doesNotMatch(forbidden, /Reintentar/);
});

test('ningún archivo llama a la ruta inexistente /alerts/{alertId} (sin /read)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
          // /alerts/<algo> que no termine en /read
          if (/alerts\/\$\{[^}]+\}(?!\/read)/.test(line)) offenders.push(`${path.relative(root, full)}: ${line.trim()}`);
        }
      }
    }
  };
  for (const dir of ['app', 'src']) walk(path.join(root, dir));
  assert.deepEqual(offenders, []);
});
