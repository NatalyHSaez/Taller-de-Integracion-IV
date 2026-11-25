/* global projectRequire */
'use strict';
/** Casos complementarios al detalle de lectura, derivados de los riesgos de S2. */
const test = require('node:test');
const assert = require('node:assert/strict');
mockModule('src/modules/monitoring/infrastructure/api/readings-api.ts', {getPatientReading: async () => {throw Error('Sin backend');}});
const { checkReadingDetail, createReadingDetail, describeConfirmationReason } =
  projectRequire('src/modules/monitoring/application/use-cases/reading-detail.ts');
const P = '25b78bc3-8a8d-48d0-8a7c-c9346beae2ed';
const OTHER = '22222222-2222-4222-8222-222222222222';
const RID = '88888888-8888-4888-8888-888888888881';
const row = (overrides={}) => ({
  readingId: RID, patientId: P, measuredAt: '2026-11-23T14:30:00Z',
  context: null, recordedBy: P, source: 'mobile', status: 'EVALUATED',
  evaluation: null, confirmationReasons: [], measurements: [
    {measurementId: 'm1', parameterCode:'SBP', value: 120, unit:'mmHg', confirmedByUser:false},
    {measurementId: 'm2', parameterCode:'DBP', value: 80, unit:'mmHg', confirmedByUser:false},
  ], ...overrides,
});
const invalid = value => assert.throws(() => checkReadingDetail(value,P,RID), e => e.code === 'INVALID_API_RESPONSE');
test('S2: paciente o lectura equivocados devuelven 404, nunca se publican', () => {
  for(const value of [row({ patientId: OTHER }), row({ readingId:'r2' })]) {
    assert.throws(() => checkReadingDetail(value,P,RID), e => e.code === 'READING_NOT_FOUND' && e.status === 404);
  }
});
test('S2: detalle inválido y sin mediciones no se considera vacío válido', () => {
  for (const value of [null, [], row({ measurements: [] }), row({ measurements: 'invalid' }),
    row({ measuredAt:'fecha inválida' }), row({status:'ARCHIVED'})]) invalid(value);
});
test('S2: un cuerpo sin identidad no muestra una lectura inexistente', () => {
  assert.throws(() => checkReadingDetail({},P,RID), e => e.code === 'READING_NOT_FOUND' && e.status === 404);
});
test('S2: evita mediciones duplicadas, no numéricas o sin confirmar explícito', () => {
  const good = row().measurements[0];
  invalid(row({ measurements: [good,good] }));
  invalid(row({ measurements: [{...good, value: Infinity}] }));
  invalid(row({ measurements: [{...good, confirmedByUser: null}] }));
});
test('S2: valida contexto de glucosa y fecha o estado de evaluación', () => {
  invalid(row({context:'UNKNOWN'}));
  invalid(row({evaluation:{status:'NORMAL', evaluatedAt:'fecha rota'}}));
  invalid(row({evaluation:{severity: 'ALTA'}}));
});
test('S2: conserva campos opcionales nulos y la evaluación recibida', () => {
  const empty = checkReadingDetail(row({context: null, recordedBy: null, evaluation: null}),P,RID);
  assert.equal(empty.evaluation, null);
  assert.equal(empty.recordedBy, null);
  const evalData = { status:'NORMAL', severity:null, explanation:'Sin anomalías', evaluatedAt:'2026-11-23T15:00:00Z' };
  assert.deepEqual(checkReadingDetail(row({evaluation:evalData}),P,RID).evaluation, evalData);
});
test('S2: muestra motivos de confirmación sin inventar diagnósticos', () => {
  assert.match(describeConfirmationReason('UNUSUAL_VALUE:GLUCOSE'), /Glucosa/);
  assert.match(describeConfirmationReason('SBP_NOT_GREATER_THAN_DBP'), /sistólica/);
  assert.equal(describeConfirmationReason('UNRECOGNIZED'), 'UNRECOGNIZED');
});
test('S2: al cambiar de lectura se descarta la respuesta antigua que llega tarde', async () => {
  let resolveOld;
  const old = new Promise(resolve=>{resolveOld=resolve;});
  const detail = createReadingDetail((_,rid) => rid === RID ? old : Promise.resolve(row({readingId: 'r2'})));
  const earlier = detail.open(P,RID);
  await detail.open(P,'r2');
  assert.equal(detail.getState().reading.readingId,'r2');
  resolveOld(row());
  await earlier;
  assert.equal(detail.getState().reading.readingId,'r2');
});
test('S2: error del servidor no rellena el detalle con datos demo', async () => {
  const detail = createReadingDetail(async () => {throw new Error('Servicio no disponible');});
  await detail.open(P,RID);
  assert.equal(detail.getState().reading, null);
  assert.equal(detail.getState().error.kind,'temporary');
});
