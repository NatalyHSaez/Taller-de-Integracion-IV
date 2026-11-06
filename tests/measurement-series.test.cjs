/* global projectRequire, __dirname */
/** Gráficos: GET /patients/{id}/measurements, series y datos para la pantalla. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakes, apiError } = require('./support/fakes.cjs');

installFakes();
const { createMeasurementSeries, toSeries, pairBloodPressure, rangeFor, loadChartMeasurements, CHART_PARAMETER_CODES } =
  projectRequire('services/measurement-series.ts');

const NOW = new Date('2026-11-06T12:00:00.000Z');
const at = (day, hour = 12) => new Date(Date.UTC(2026, 10, day, hour)).toISOString();
const point = (readingId, measuredAt, parameterCode, value, unit) => ({ readingId, measuredAt, parameterCode, value, unit });

/** Servidor simulado con la lógica de seguimiento/rutas.py (serie). */
function server(byPatient) {
  const calls = [];
  const fetch = async (patientId, query) => {
    calls.push({ patientId, ...query });
    return (byPatient[patientId] ?? [])
      .filter((p) => !query.parameterCode || p.parameterCode === query.parameterCode)
      .filter((p) => !query.from || p.measuredAt >= query.from)
      .filter((p) => !query.to || p.measuredAt <= query.to)
      .sort((a, b) => (a.measuredAt < b.measuredAt ? -1 : 1));
  };
  return { fetch, calls };
}

const PIA = [
  point('r1', at(4), 'SBP', 130, 'mmHg'), point('r1', at(4), 'DBP', 85, 'mmHg'), point('r1', at(4), 'HEART_RATE', 70, 'bpm'),
  point('r2', at(5), 'SBP', 125, 'mmHg'), point('r2', at(5), 'DBP', 80, 'mmHg'),
  point('r3', at(3), 'GLUCOSE', 98.5, 'mg/dL'),
  point('r4', at(2), 'WEIGHT', 72.4, 'kg'),
  point('r0', at(1, 3), 'SBP', 140, 'mmHg'), point('r0', at(1, 3), 'DBP', 90, 'mmHg'),
];

test('consulta por parameterCode, from y to; la presión pide SBP y DBP', async () => {
  const s = server({ pia: PIA });
  const series = createMeasurementSeries(s.fetch, { now: () => NOW });
  await series.setPatient('pia');
  const range = rangeFor(30, NOW);
  assert.deepEqual(s.calls.map((c) => c.parameterCode).sort(), ['DBP', 'SBP']);
  for (const call of s.calls) {
    assert.equal(call.patientId, 'pia');
    assert.equal(call.from, range.from);
    assert.equal(call.to, NOW.toISOString());
  }
  for (const [chart, code] of [['heart_rate', 'HEART_RATE'], ['glucose', 'GLUCOSE'], ['weight', 'WEIGHT']]) {
    await series.setChart(chart);
    assert.equal(s.calls.at(-1).parameterCode, code);
  }
  await series.setRange(null);
  assert.equal(s.calls.at(-1).from, undefined, '"Todo" no envía from');
});

test('presión, pulso, glucosa y peso con valores, orden ascendente y unidad del backend', async () => {
  const s = server({ pia: PIA });
  const series = createMeasurementSeries(s.fetch, { now: () => NOW });
  await series.setPatient('pia');
  let [sbp, dbp] = series.getState().result.series;
  assert.deepEqual(sbp.points.map((p) => [p.readingId, p.value]), [['r0', 140], ['r1', 130], ['r2', 125]]);
  assert.deepEqual(dbp.points.map((p) => p.value), [90, 85, 80]);
  assert.equal(sbp.unit, 'mmHg');

  await series.setChart('heart_rate');
  assert.deepEqual(series.getState().result.series[0], { parameterCode: 'HEART_RATE', unit: 'bpm', points: [{ readingId: 'r1', measuredAt: at(4), value: 70 }] });
  await series.setChart('glucose');
  assert.equal(series.getState().result.series[0].points[0].value, 98.5);
  assert.equal(series.getState().result.series[0].unit, 'mg/dL');
  await series.setChart('weight');
  assert.equal(series.getState().result.series[0].unit, 'kg');
});

test('toSeries ordena, descarta otros parámetros y valores inválidos', () => {
  const s = toSeries('GLUCOSE', [
    point('b', at(5), 'GLUCOSE', 110, 'mg/dL'),
    point('x', at(4), 'WEIGHT', 70, 'kg'),
    point('a', at(3), 'GLUCOSE', 100, 'mg/dL'),
    point('c', at(6), 'GLUCOSE', Number.NaN, 'mg/dL'),
  ]);
  assert.deepEqual(s.points.map((p) => p.readingId), ['a', 'b']);
  assert.equal(s.unit, 'mg/dL');
});

test('la presión solo usa lecturas con sistólica y diastólica', () => {
  const [sbp, dbp] = pairBloodPressure([
    toSeries('SBP', [point('r1', at(1), 'SBP', 120, 'mmHg'), point('r2', at(2), 'SBP', 130, 'mmHg')]),
    toSeries('DBP', [point('r2', at(2), 'DBP', 85, 'mmHg')]),
  ]);
  assert.deepEqual(sbp.points.map((p) => p.readingId), ['r2']);
  assert.deepEqual(dbp.points.map((p) => p.readingId), ['r2']);
});

test('cambiar de gráfico o rango no mezcla series; volver usa la caché', async () => {
  const s = server({ pia: PIA });
  const series = createMeasurementSeries(s.fetch, { now: () => NOW });
  await series.setPatient('pia');
  const pending = series.setChart('glucose');
  assert.equal(series.getState().result, null, 'mientras carga no se muestra la serie anterior');
  assert.equal(series.getState().loading, true);
  await pending;
  assert.equal(series.getState().result.chart, 'glucose');
  const calls = s.calls.length;
  await series.setChart('blood_pressure');
  assert.equal(s.calls.length, calls);
  assert.equal(series.getState().result.series[0].parameterCode, 'SBP');
});

test('el cambio de paciente invalida la serie previa y descarta respuestas tardías', async () => {
  const gates = [];
  const fetch = (patientId, query) =>
    new Promise((resolve) => gates.push(() => resolve(PIA.filter((p) => p.parameterCode === query.parameterCode).map((p) => ({ ...p, readingId: `${patientId}-${p.readingId}` })))));
  const series = createMeasurementSeries(fetch, { now: () => NOW });
  const first = series.setPatient('pia');
  gates.splice(0).forEach((open) => open());
  await first;
  assert.ok(series.getState().result.series[0].points[0].readingId.startsWith('pia-'));

  const slow = series.refresh(); // respuesta de pía que llegará tarde
  const late = gates.splice(0);
  const change = series.setPatient('rosa');
  assert.equal(series.getState().result, null, 'la serie de pía se descarta de inmediato');
  gates.splice(0).forEach((open) => open());
  await change;
  late.forEach((open) => open());
  await slow;
  assert.ok(series.getState().result.series[0].points.every((p) => p.readingId.startsWith('rosa-')));
});

test('estados: error con reintento y error al actualizar conservando datos', async () => {
  let fail = true;
  const series = createMeasurementSeries(async (patientId, query) => {
    if (fail) throw apiError('SERVICE_UNAVAILABLE', 503);
    return PIA.filter((p) => p.parameterCode === query.parameterCode);
  }, { now: () => NOW });
  await series.setPatient('pia');
  assert.equal(series.getState().result, null);
  assert.ok(series.getState().error);
  fail = false;
  await series.refresh();
  assert.equal(series.getState().error, null);
  assert.ok(series.getState().result);
  fail = true;
  await series.refresh();
  assert.ok(series.getState().error);
  assert.ok(series.getState().result, 'se conservan los datos anteriores');
});

test('pantalla: pide cada parámetro a /measurements y arma presión, glucosa y peso', async () => {
  const { fetch, calls } = server({ pia: PIA });
  const items = await loadChartMeasurements('pia', fetch);
  assert.deepEqual(calls.map((c) => c.parameterCode), [...CHART_PARAMETER_CODES]);
  assert.ok(calls.every((c) => c.patientId === 'pia'));
  const byId = Object.fromEntries(items.map((m) => [m.id, m]));
  assert.deepEqual(
    { type: byId.r1.type, systolic: byId.r1.systolic, diastolic: byId.r1.diastolic, heartRate: byId.r1.heartRate },
    { type: 'blood_pressure', systolic: 130, diastolic: 85, heartRate: 70 },
  );
  assert.equal(byId['r3-glucose'].value, 98.5);
  assert.equal(byId['r4-weight'].value, 72.4);
  assert.equal(byId['r4-weight'].measuredAt, at(2));
});

test('pantalla: sin mediciones devuelve vacío y los errores se propagan', async () => {
  assert.deepEqual(await loadChartMeasurements('nadie', server({}).fetch), []);
  await assert.rejects(loadChartMeasurements('pia', () => Promise.reject(apiError('FORBIDDEN', 403))));
});

test('la pantalla de gráficos conserva su diseño original (LineChart) y usa /measurements', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'app', '(tabs)', 'graficos.tsx'), 'utf8');
  assert.match(source, /react-native-gifted-charts/);
  assert.match(source, /loadChartMeasurements\(patientId\)/);
  assert.doesNotMatch(source, /getPatientReadings|measurement-series-panel/);
});
