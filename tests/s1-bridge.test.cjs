/* global projectRequire */
'use strict';
/** Casos complementarios al historial de main, derivados de los riesgos de S1. */
const test = require('node:test');
const assert = require('node:assert/strict');
mockModule('src/modules/monitoring/infrastructure/readings-api.ts', {getPatientReadings: async () => {throw Error('Sin backend');}});
const { checkHistoryPage, mergeReadings, lastDaysRange, createReadingsHistory } =
  projectRequire('src/modules/monitoring/application/readings-history.ts');
const P1 = '25b78bc3-8a8d-48d0-8a7c-c9346beae2ed';
const P2 = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-11-23T12:00:00Z');
const reading = (id, patientId = P1, overrides = {}) => ({
  readingId: id, patientId, measuredAt: '2026-11-22T15:10:00Z',
  status: 'EVALUATED', measurements: [
    { measurementId: `${id}-sbp`, parameterCode: 'SBP', value: 120, unit: 'mmHg', confirmedByUser: false },
    { measurementId: `${id}-dbp`, parameterCode: 'DBP', value: 80, unit: 'mmHg', confirmedByUser: false },
  ], ...overrides,
});
const page = (items, n = 1, total = items.length, size = 20) => ({ total, page:n, size, items });
function invalid(fn) {
  assert.throws(fn, error => error.code === 'INVALID_API_RESPONSE');
}
test('S1: la página de otro paciente no se incorpora al historial', () => {
  invalid(() => checkHistoryPage(page([reading('r2', P2)]), P1, 1));
});
test('S1: IDs de lectura repetidos en la misma página se rechazan', () => {
  invalid(() => checkHistoryPage(page([reading('r1'), reading('r1')]), P1, 1));
});
test('S1: no confunde errores de paginación con una lista vacía', () => {
  for (const broken of [null, [], { items: [] }, page([], 2), page([], 1, -1),
    page([], 1, 0, 0), page([reading('r1')], 1, 1, 0)]) {
    invalid(() => checkHistoryPage(broken, P1, 1));
  }
  assert.deepEqual(checkHistoryPage(page([], 1, 0), P1, 1).items, []);
});
test('S1: rechaza fecha, estado, mediciones y valores inválidos', () => {
  const variants = [
    reading('r1', P1, { measuredAt: 'fecha incorrecta' }),
    reading('r1', P1, { status: 'UNKNOWN' }),
    reading('r1', P1, { measurements: 'n/a' }),
    reading('r1', P1, { measurements: [{ parameterCode: 'SBP', value: Number.NaN }] }),
  ];
  for (const entry of variants) invalid(() => checkHistoryPage(page([entry]), P1, 1));
});
test('S1: conserva parámetros de una lectura mixta sin inventar datos', () => {
  const full = reading('r1', P1, { measurements: [
    { parameterCode: 'SBP', value: 124 }, { parameterCode: 'DBP', value: 82 },
    { parameterCode: 'HEART_RATE', value: 76 }, { parameterCode: 'GLUCOSE', value: 106 },
    { parameterCode: 'WEIGHT', value: 71 },
  ] });
  const result = checkHistoryPage(page([full]), P1, 1);
  assert.equal(result.items[0].readingId, 'r1');
  assert.deepEqual(result.items[0].measurements.map(m => m.parameterCode),
    ['SBP', 'DBP', 'HEART_RATE', 'GLUCOSE', 'WEIGHT']);
});
test('S1: une páginas solapadas sin duplicar lecturas y ordena por fecha', () => {
  const a = reading('a', P1, { measuredAt: '2026-11-22T10:00:00Z' });
  const b = reading('b', P1, { measuredAt: '2026-11-23T08:00:00Z' });
  const c = reading('c', P1, { measuredAt: '2026-11-23T09:00:00Z' });
  assert.deepEqual(mergeReadings([a,b],[b,c]).map(x=>x.readingId), ['c','b','a']);
});
test('S1: últimos siete días parten a medianoche local y no al mediodía', () => {
  const date = lastDaysRange(7, NOW);
  const expected = new Date(NOW);
  expected.setHours(0,0,0,0);
  expected.setDate(expected.getDate() - 6);
  assert.equal(date.from, expected.toISOString());
  assert.equal(date.to, null);
});
test('S1: cambiar de paciente no reutiliza resultados ni caché anteriores', async () => {
  let calls = 0;
  const history = createReadingsHistory(async patientId => {
    calls++;
    return page([reading(`${patientId}-${calls}`, patientId)]);
  }, { now: () => NOW });
  await history.setPatient(P1);
  assert.equal(history.getState().items[0].patientId, P1);
  await history.setPatient(P2);
  assert.equal(history.getState().items[0].patientId, P2);
  await history.setPatient(P1);
  assert.equal(history.getState().items[0].patientId, P1);
  assert.equal(calls, 3, 'cada regreso de paciente recarga desde el backend');
});
test('S1: un error de backend no muestra mediciones de demostración', async () => {
  const history = createReadingsHistory(async () => {throw new Error('Seguimiento caído');}, {now:()=>NOW});
  await history.setPatient(P1);
  assert.equal(history.getState().items.length, 0);
  assert.ok(history.getState().error);
});
