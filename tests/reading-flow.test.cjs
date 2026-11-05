/* global projectRequire */
/**
 * Flujo completo: catálogo → formulario → envío → confirmación → resultado pendiente.
 * Usa los servicios reales con la capa HTTP simulada.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakes, apiError } = require('./support/fakes.cjs');

const fakes = installFakes();
const { clinicalParametersService, validateAgainstParameter } = projectRequire('services/clinical-parameters.ts');
const { buildCreateReadingRequest, readingsService } = projectRequire('services/readings.ts');
const { createReadingFlow } = projectRequire('services/reading-flow.ts');

const PATIENT = fakes.userId;
const REASONS = ['Valor sistólico fuera de lo habitual para este paciente', 'Diferencia alta respecto de la lectura anterior'];

async function fillAndSubmit(flow) {
  // 1. Catálogo: límites efectivos (SBP viene de /parameter-limits).
  const catalog = await clinicalParametersService.list({ forceRefresh: true });
  assert.equal(catalog.SBP.limitsSource, 'parameter-limits');

  // 2. Formulario: la validación preventiva usa esos límites.
  assert.match(validateAgainstParameter(catalog.SBP, '290'), /máximo aceptado es 280 mmHg/);
  const values = { SBP: '185', DBP: '95', HEART_RATE: '88' };
  for (const code of Object.keys(values)) assert.equal(validateAgainstParameter(catalog[code], values[code]), null);

  // 3. Envío.
  const request = buildCreateReadingRequest({
    codes: ['SBP', 'DBP', 'HEART_RATE'], values, catalog, context: null, measuredAt: new Date(2026, 0, 15, 8, 30),
  });
  await flow.submit(PATIENT, request);
  return request;
}

test('lectura inusual: confirmar la deja PENDING y explica la evaluación asíncrona', async () => {
  fakes.calls.post.length = 0;
  const flow = createReadingFlow(readingsService);
  fakes.replyPost({ readingId: 'r-100', status: 'REQUIRES_CONFIRMATION', confirmationReasons: REASONS });

  await fillAndSubmit(flow);
  let state = flow.getState();
  assert.equal(state.step, 'confirming');
  assert.deepEqual(state.reading.reasons, REASONS, 'los motivos se conservan tal cual');
  assert.equal(fakes.calls.post.length, 1, 'aún no se llamó a /confirm');

  // 4. Confirmación consciente.
  fakes.replyPost({ readingId: 'r-100', status: 'PENDING' });
  await flow.confirm();
  assert.equal(fakes.calls.post[1].path, `/patients/${PATIENT}/readings/r-100/confirm`);

  // 5. Resultado pendiente.
  state = flow.getState();
  assert.equal(state.step, 'result');
  assert.equal(state.reading.status, 'PENDING');

  // Actualizar consulta el estado de esa misma lectura.
  fakes.replyGet({ readingId: 'r-100', status: 'EVALUATED' });
  await flow.refresh();
  assert.equal(fakes.calls.get.at(-1).path, `/patients/${PATIENT}/readings/r-100`);
  assert.equal(flow.getState().reading.status, 'EVALUATED');
});

test('cancelar no llama al endpoint de confirmación', async () => {
  fakes.calls.post.length = 0;
  const flow = createReadingFlow(readingsService);
  fakes.replyPost({ readingId: 'r-200', status: 'REQUIRES_CONFIRMATION', confirmationReasons: REASONS });
  await fillAndSubmit(flow);

  flow.cancel();
  assert.equal(flow.getState().step, 'unconfirmed');
  assert.equal(fakes.calls.post.filter((c) => c.path.endsWith('/confirm')).length, 0);

  // Puede reabrir y confirmar después.
  flow.reopen();
  assert.equal(flow.getState().step, 'confirming');
});

test('un doble toque en confirmar envía una sola confirmación', async () => {
  fakes.calls.post.length = 0;
  const flow = createReadingFlow(readingsService);
  fakes.replyPost({ readingId: 'r-300', status: 'REQUIRES_CONFIRMATION', confirmationReasons: [] });
  await fillAndSubmit(flow);
  fakes.replyPost(() => new Promise((resolve) => setTimeout(() => resolve({ readingId: 'r-300', status: 'PENDING' }), 20)));
  await Promise.all([flow.confirm(), flow.confirm()]);
  assert.equal(fakes.calls.post.filter((c) => c.path.endsWith('/confirm')).length, 1);
  assert.equal(flow.getState().step, 'result');
});

test('READING_NOT_FOUND y READING_NOT_PENDING_CONFIRMATION se muestran sin cerrar el modal', async () => {
  const flow = createReadingFlow(readingsService);
  fakes.replyPost({ readingId: 'r-400', status: 'REQUIRES_CONFIRMATION', confirmationReasons: REASONS });
  await fillAndSubmit(flow);

  fakes.replyPost(() => { throw apiError('READING_NOT_FOUND', 404); });
  await flow.confirm();
  assert.equal(flow.getState().step, 'confirming');
  assert.equal(flow.getState().error.kind, 'not_found');

  fakes.replyPost(() => { throw apiError('READING_NOT_PENDING_CONFIRMATION', 409); });
  await flow.confirm();
  assert.equal(flow.getState().error.kind, 'not_pending');

  // "Actualizar estado" desde el error consulta la lectura y muestra el resultado.
  fakes.replyGet({ readingId: 'r-400', status: 'PENDING' });
  await flow.refresh();
  assert.equal(flow.getState().step, 'result');
  assert.equal(flow.getState().reading.status, 'PENDING');
});

test('una lectura sin observaciones va directo al resultado, sin modal', async () => {
  const flow = createReadingFlow(readingsService);
  fakes.replyPost({ readingId: 'r-500', status: 'PENDING' });
  await fillAndSubmit(flow);
  assert.equal(flow.getState().step, 'result');
});

test('un 422 vuelve al formulario con el error en el campo', async () => {
  const flow = createReadingFlow(readingsService);
  fakes.replyPost(() => { throw apiError('OUT_OF_RANGE', 422, { parameterCode: 'SBP', min: 60, max: 280, unit: 'mmHg' }); });
  await fillAndSubmit(flow);
  const state = flow.getState();
  assert.equal(state.step, 'form');
  assert.match(state.errors.fields.SBP, /60–280 mmHg/);
});
