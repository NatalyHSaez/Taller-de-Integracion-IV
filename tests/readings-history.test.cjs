/* global projectRequire */
/**
 * Historial de lecturas: paginación, filtros, actualización, cambio de
 * paciente, estados de la lista y elemento que abre el detalle.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const { installFakes } = require('./support/fakes.cjs');

installFakes();
const { createReadingsHistory, mergeReadings, lastDaysRange } = projectRequire('src/modules/monitoring/application/readings-history.ts');
const { Colors } = projectRequire('src/shared/presentation/theme.ts');
const { ReadingHistoryItem, READING_STATUS_BADGES } = projectRequire('src/modules/monitoring/presentation/components/reading-history-item.tsx');

const NOW = new Date('2026-11-06T12:00:00.000Z');
const minutesAgo = (n) => new Date(NOW.getTime() - n * 60_000).toISOString();

function reading(id, measuredAt, codes = ['SBP', 'DBP'], status = 'EVALUATED') {
  return {
    readingId: id,
    patientId: 'p1',
    measuredAt,
    status,
    confirmationReasons: [],
    measurements: codes.map((code, index) => ({
      measurementId: `${id}-${index}`,
      parameterCode: code,
      value: 100 + index,
      unit: code === 'GLUCOSE' ? 'mg/dL' : code === 'WEIGHT' ? 'kg' : code === 'HEART_RATE' ? 'bpm' : 'mmHg',
      confirmedByUser: false,
    })),
  };
}

/** Servidor simulado con la misma lógica que seguimiento/rutas.py (historial). */
function fakeServer(initial) {
  const db = { byPatient: new Map(Object.entries(initial)) };
  const calls = [];
  const fetchPage = async (patientId, query) => {
    calls.push({ patientId, ...query });
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    let rows = [...(db.byPatient.get(patientId) ?? [])];
    if (query.parameterCode) rows = rows.filter((r) => r.measurements.some((m) => m.parameterCode === query.parameterCode));
    if (query.from) rows = rows.filter((r) => r.measuredAt >= query.from);
    if (query.to) rows = rows.filter((r) => r.measuredAt <= query.to);
    rows.sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : a.measuredAt > b.measuredAt ? -1 : 0));
    return { total: rows.length, page, size, items: rows.slice((page - 1) * size, page * size) };
  };
  const insert = (patientId, row) => db.byPatient.get(patientId).unshift(row);
  return { fetchPage, calls, insert };
}

const seven = () => Array.from({ length: 7 }, (_, i) => reading(`r${i + 1}`, minutesAgo((i + 1) * 60)));

test('la consulta envía page, size, parameterCode, from y to', async () => {
  const server = fakeServer({ p1: seven() });
  const history = createReadingsHistory(server.fetchPage, { pageSize: 3, now: () => NOW });
  await history.setPatient('p1');
  assert.deepEqual(server.calls[0], {
    patientId: 'p1', page: 1, size: 3, parameterCode: undefined, from: undefined, to: NOW.toISOString(),
  });

  const range = lastDaysRange(7, NOW);
  await history.setFilters({ parameterCode: 'GLUCOSE', ...range });
  assert.deepEqual(server.calls.at(-1), {
    patientId: 'p1', page: 1, size: 3, parameterCode: 'GLUCOSE', from: range.from, to: NOW.toISOString(),
  });
  // "Últimos 7 días" = desde las 00:00 locales de hace 6 días (hoy incluido).
  const expected = new Date(NOW);
  expected.setHours(0, 0, 0, 0);
  expected.setDate(expected.getDate() - 6);
  assert.equal(range.from, expected.toISOString());
  assert.equal(range.to, null);
});

test('la paginación recorre todo sin duplicar ni omitir, más reciente primero', async () => {
  const server = fakeServer({ p1: seven() });
  const history = createReadingsHistory(server.fetchPage, { pageSize: 3, now: () => NOW });
  await history.setPatient('p1');
  assert.deepEqual(history.getState().items.map((r) => r.readingId), ['r1', 'r2', 'r3']);
  assert.equal(history.getState().hasMore, true);

  // Llega una lectura nueva mientras se recorre el historial.
  server.insert('p1', reading('nueva', new Date(NOW.getTime() + 60_000).toISOString()));

  await history.loadMore();
  await history.loadMore();
  const state = history.getState();
  assert.deepEqual(state.items.map((r) => r.readingId), ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']);
  assert.equal(state.hasMore, false);
  assert.equal(new Set(state.items.map((r) => r.readingId)).size, state.items.length);
  // Todas las páginas usan el mismo límite superior.
  assert.ok(server.calls.every((call) => call.to === NOW.toISOString()));
  await history.loadMore();
  assert.equal(server.calls.length, 3, 'sin más páginas no se vuelve a consultar');

  // Actualizar fija un límite nuevo y trae la lectura nueva al principio.
  const later = new Date(NOW.getTime() + 5 * 60_000);
  const refreshed = createReadingsHistory(server.fetchPage, { pageSize: 3, now: () => later });
  await refreshed.setPatient('p1');
  assert.equal(refreshed.getState().items[0].readingId, 'nueva');
});

test('mergeReadings descarta repetidos y mantiene el orden descendente', () => {
  const a = reading('a', minutesAgo(10));
  const b = reading('b', minutesAgo(20));
  const c = reading('c', minutesAgo(5));
  assert.deepEqual(mergeReadings([a, b], [b, c]).map((r) => r.readingId), ['c', 'a', 'b']);
});

test('cambiar filtros vuelve a la página 1 y reutiliza la caché del mismo filtro', async () => {
  const rows = [
    reading('g1', minutesAgo(10), ['GLUCOSE']),
    reading('b1', minutesAgo(20)),
    reading('w1', minutesAgo(30), ['WEIGHT']),
  ];
  const server = fakeServer({ p1: rows });
  const history = createReadingsHistory(server.fetchPage, { pageSize: 2, now: () => NOW });
  await history.setPatient('p1');
  await history.setFilters({ parameterCode: 'GLUCOSE' });
  assert.deepEqual(history.getState().items.map((r) => r.readingId), ['g1']);
  assert.equal(history.getState().page, 1);

  const before = server.calls.length;
  await history.setFilters({ parameterCode: null });
  assert.equal(server.calls.length, before, 'el filtro ya consultado sale de caché');
  assert.deepEqual(history.getState().items.map((r) => r.readingId), ['g1', 'b1']);
});

test('al cambiar de paciente se limpian resultados y caché, y se ignoran respuestas tardías', async () => {
  const gates = [];
  const calls = [];
  const fetchPage = (patientId, query) => {
    calls.push({ patientId, ...query });
    const response = { total: 1, page: 1, size: 20, items: [reading(`${patientId}-r`, minutesAgo(1))] };
    return new Promise((resolve) => gates.push(() => resolve(response)));
  };
  const history = createReadingsHistory(fetchPage, { now: () => NOW });

  const first = history.setPatient('p1');
  gates.shift()();
  await first;
  await Promise.resolve();
  assert.deepEqual(history.getState().items.map((r) => r.readingId), ['p1-r']);

  // Una actualización de p1 queda pendiente y el usuario cambia a p2.
  const slowRefresh = history.refresh();
  const lateP1 = gates.shift();
  const change = history.setPatient('p2');
  assert.deepEqual(history.getState().items, [], 'los resultados del paciente anterior se limpian de inmediato');
  gates.shift()();
  await change;
  lateP1(); // la respuesta de p1 llega tarde
  await slowRefresh;
  assert.deepEqual(history.getState().items.map((r) => r.readingId), ['p2-r']);
  assert.equal(history.getState().patientId, 'p2');

  // Volver a p1 no reutiliza caché: consulta de nuevo.
  const before = calls.length;
  const back = history.setPatient('p1');
  gates.shift()();
  await back;
  assert.equal(calls.length, before + 1);
  assert.deepEqual(history.getState().items.map((r) => r.readingId), ['p1-r']);
});

test('estados: carga, vacío, error con reintento y error al cargar más', async () => {
  let fail = true;
  let resolveFirst;
  const fetchPage = (patientId, query) => {
    if (query.page === 1 && resolveFirst === undefined) {
      return new Promise((resolve) => { resolveFirst = resolve; });
    }
    if (fail) return Promise.reject(new Error('sin conexión'));
    return Promise.resolve({ total: 0, page: 1, size: 20, items: [] });
  };
  const history = createReadingsHistory(fetchPage, { now: () => NOW });
  const loading = history.setPatient('p1');
  assert.equal(history.getState().loading, true);
  resolveFirst({ total: 0, page: 1, size: 20, items: [] });
  await loading;
  assert.equal(history.getState().loading, false);
  assert.equal(history.getState().items.length, 0, 'vacío');

  await history.refresh();
  assert.ok(history.getState().error, 'error visible');
  fail = false;
  await history.retry();
  assert.equal(history.getState().error, null);

  // Error en la página 2: se conserva lo cargado y se puede reintentar.
  const rows = seven();
  let failPage2 = true;
  const paged = createReadingsHistory(async (patientId, query) => {
    if (query.page === 2 && failPage2) throw new Error('timeout');
    const items = rows.slice((query.page - 1) * 3, query.page * 3);
    return { total: rows.length, page: query.page, size: 3, items };
  }, { pageSize: 3, now: () => NOW });
  await paged.setPatient('p1');
  await paged.loadMore();
  assert.ok(paged.getState().loadMoreError);
  assert.equal(paged.getState().items.length, 3);
  failPage2 = false;
  await paged.loadMore();
  assert.equal(paged.getState().items.length, 6);
  assert.equal(paged.getState().loadMoreError, null);
});

test('el elemento muestra los tres estados y abre el detalle con el readingId real', () => {
  const theme = Colors.light;
  const opened = [];
  for (const status of ['PENDING', 'REQUIRES_CONFIRMATION', 'EVALUATED']) {
    const tree = ReadingHistoryItem({
      reading: reading(`id-${status}`, minutesAgo(5), ['SBP', 'DBP'], status),
      theme,
      onOpen: (id) => opened.push(id),
    });
    const html = renderToStaticMarkup(tree);
    assert.ok(html.includes(READING_STATUS_BADGES[status].label), `falta la etiqueta de ${status}`);
    tree.props.onPress();
  }
  assert.deepEqual(opened, ['id-PENDING', 'id-REQUIRES_CONFIRMATION', 'id-EVALUATED']);

  // Una presión sin pulso también se muestra (HEART_RATE es opcional).
  const html = renderToStaticMarkup(
    ReadingHistoryItem({ reading: reading('x', minutesAgo(1), ['SBP', 'DBP']), theme, onOpen() {} }),
  );
  assert.match(html, /Presión arterial/);
  assert.match(html, /100 \/ 101 mmHg/);
});
