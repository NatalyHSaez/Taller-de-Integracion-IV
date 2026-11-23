/* global projectRequire, mockModule */
'use strict';
/** S3: contratos clínicos y riesgos originales contrastados con la implementación modular. */
const test = require('node:test');
const assert = require('node:assert/strict');
mockModule('src/modules/monitoring/infrastructure/readings-api.ts', {
  getPatientMeasurements: async () => { throw new Error('No se configuró la respuesta de prueba.'); },
});
const { CHARTS, checkMeasurementSeries, createMeasurementSeries, pairBloodPressure,
  rangeFor, toSeries } = projectRequire('src/modules/monitoring/application/measurement-series.ts');

const NOW = new Date('2026-11-23T16:45:00.000Z');
const P1 = '25b78bc3-8a8d-48d0-8a7c-c9346beae2ed';
const P2 = '22222222-2222-4222-8222-222222222222';
const point = (code = 'GLUCOSE', value = 102, readingId = 'lectura-1', measuredAt = '2026-11-20T14:00:00Z') => ({
  readingId, measuredAt, parameterCode: code, value,
  unit: ({GLUCOSE:'mg/dL', WEIGHT:'kg', SBP:'mmHg', DBP:'mmHg', HEART_RATE:'bpm'})[code],
});
const invalid = (raw, code = 'GLUCOSE') =>
  assert.throws(() => checkMeasurementSeries(raw, code), (e) => e.code === 'INVALID_API_RESPONSE');

// El contrato modular no permite interpretar errores como una serie válida vacía.
test('S3: rechaza objetos paginados, null y valores no-array', () => {
  for (const raw of [null, {}, {items: []}, '[]', 0]) invalid(raw);
  assert.deepEqual(checkMeasurementSeries([], 'GLUCOSE'), []);
});
test('S3: rechaza readingId ausente, valores no numéricos o infinitos', () => {
  for (const raw of [{...point(), readingId:null}, {...point(), value:'102'},
    {...point(), value:NaN}, {...point(), value:Infinity}]) invalid([raw]);
});
test('S3: evita parámetros no solicitados, fechas inválidas y duplicados', () => {
  invalid([point('WEIGHT', 69)], 'GLUCOSE');
  invalid([{...point(), measuredAt:'fecha imposible'}]);
  invalid([point(), point()]);
});
test('S3: conserva unidad y orden temporal ascendente sin inventar observaciones', () => {
  const series = toSeries('GLUCOSE', [
    point('GLUCOSE', 111, 'segundo', '2026-11-22T00:00:00Z'),
    point('WEIGHT', 79, 'ajeno'),
    point('GLUCOSE', 100, 'primero', '2026-11-20T00:00:00Z'),
    point('GLUCOSE', Number.NaN, 'invalid'),
  ]);
  assert.equal(series.unit, 'mg/dL');
  assert.deepEqual(series.points.map((p) => [p.readingId, p.value]), [['primero',100], ['segundo',111]]);
});
test('S3: la presión no inventa lectura sistólica o diastólica faltante', () => {
  const paired = pairBloodPressure([
    toSeries('SBP', [point('SBP', 125, 'completa'), point('SBP', 137, 'sin-dbp')]),
    toSeries('DBP', [point('DBP', 81, 'completa'), point('DBP', 90, 'sin-sbp')]),
  ]);
  assert.deepEqual(paired.map((s) => s.points.map((p) => p.readingId)), [['completa'], ['completa']]);
});
test('S3: siete días comienzan a medianoche local y Todo no impone from', () => {
  const expected = new Date(NOW);
  expected.setHours(0,0,0,0);
  expected.setDate(expected.getDate() - 6);
  assert.equal(rangeFor(7, NOW).from, expected.toISOString());
  assert.deepEqual(rangeFor(null, NOW), {from:null, to:NOW.toISOString()});
});
test('S3: presión requiere SBP y DBP, pulso, glucosa y peso tienen su código', () => {
  assert.deepEqual(CHARTS.blood_pressure.codes, ['SBP','DBP']);
  assert.deepEqual(CHARTS.heart_rate.codes, ['HEART_RATE']);
  assert.deepEqual(CHARTS.glucose.codes, ['GLUCOSE']);
  assert.deepEqual(CHARTS.weight.codes, ['WEIGHT']);
});
test('S3: paciente, gráfico y rango forman consultas independientes con caché', async () => {
  const calls = [];
  const series = createMeasurementSeries(async (id, query) => {
    calls.push({ id, ...query });
    return [point(query.parameterCode, 80, `${id}-${query.parameterCode}`)];
  }, {now:()=>NOW});
  await series.setPatient(P1);
  assert.equal(calls.length, 2);
  await series.setChart('glucose');
  assert.equal(calls.length, 3);
  await series.setChart('blood_pressure');
  assert.equal(calls.length, 3, 'no se repite la consulta con clave idéntica');
  await series.setRange(7);
  assert.equal(calls.length, 5);
  await series.setPatient(P2);
  assert.equal(calls.length, 7);
  assert.ok(series.getState().result.series.every((s) => s.points.every((p) => p.readingId.startsWith(P2))));
});
test('S3: respuesta de un paciente anterior no reemplaza la del paciente activo', async () => {
  const waits = [];
  const series = createMeasurementSeries((id, query) => new Promise((resolve) => {
    waits.push({id, code:query.parameterCode, resolve});
  }), {now:()=>NOW});
  const oldLoad = series.setPatient(P1);
  const oldRequests = waits.splice(0);
  const nextLoad = series.setPatient(P2);
  const newRequests = waits.splice(0);
  for (const r of newRequests) r.resolve([point(r.code, 88, `${P2}-lectura`)]);
  await nextLoad;
  for (const r of oldRequests) r.resolve([point(r.code, 122, `${P1}-lectura`)]);
  await oldLoad;
  assert.equal(series.getState().patientId, P2);
  assert.ok(series.getState().result.series.every((s) => s.points.every((p) => p.readingId.startsWith(P2))));
});
test('S3: error del Gateway no crea puntos mock ni reutiliza datos anteriores', async () => {
  let fail = false;
  const series = createMeasurementSeries(async (id, query) => {
    if (fail) throw new Error('Gateway no disponible');
    return [point(query.parameterCode, 102, id)];
  }, {now:()=>NOW});
  await series.setPatient(P1);
  fail = true;
  await series.setPatient(P2);
  assert.equal(series.getState().result, null);
  assert.ok(series.getState().error);
  assert.equal(series.getState().patientId, P2);
});
