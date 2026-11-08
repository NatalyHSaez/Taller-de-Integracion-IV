/* global projectRequire */
/** Pruebas del servicio de lecturas (creación, confirmación y errores). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakes, apiError } = require('./support/fakes.cjs');

const fakes = installFakes();
const readings = projectRequire('src/modules/monitoring/application/readings.ts');
const { readingErrorsFromApi } = projectRequire('src/modules/monitoring/application/reading-errors.ts');
const { clinicalParametersService } = projectRequire('src/modules/monitoring/application/clinical-parameters.ts');

const PATIENT = fakes.userId;
let catalog;
test.before(async () => {
  catalog = await clinicalParametersService.list();
});

function bloodPressureRequest() {
  return readings.buildCreateReadingRequest({
    codes: ['SBP', 'DBP', 'HEART_RATE'],
    values: { SBP: '120', DBP: '80', HEART_RATE: '72' },
    catalog,
    context: null,
    measuredAt: new Date(2026, 0, 15, 8, 30),
  });
}

test('el cuerpo usa source mobile, fecha con zona horaria y unidades del catálogo', () => {
  const request = bloodPressureRequest();
  assert.equal(request.source, 'mobile');
  assert.match(request.measuredAt, /^2026-01-15T08:30:00[+-]\d{2}:\d{2}$/);
  assert.equal(request.context, undefined);
  assert.deepEqual(
    request.measurements.map((m) => [m.parameterCode, m.value, m.unit]),
    [['SBP', 120, 'mmHg'], ['DBP', 80, 'mmHg'], ['HEART_RATE', 72, 'bpm']],
  );
});

test('glucosa exige PREPRANDIAL o POSTPRANDIAL', () => {
  const build = (context) => readings.buildCreateReadingRequest({
    codes: ['GLUCOSE'], values: { GLUCOSE: '105' }, catalog, context, measuredAt: new Date(2026, 0, 15),
  });
  assert.throws(() => build(null), { code: 'CONTEXT_REQUIRED' });
  assert.equal(build('POSTPRANDIAL').context, 'POSTPRANDIAL');
});

test('create envía un solo POST aunque se toque dos veces', async () => {
  fakes.calls.post.length = 0;
  fakes.replyPost(() => new Promise((resolve) => setTimeout(() => resolve({ readingId: 'r-1', status: 'PENDING' }), 20)));
  const request = bloodPressureRequest();
  const [first, second] = await Promise.all([
    readings.readingsService.create(PATIENT, request),
    readings.readingsService.create(PATIENT, request),
  ]);
  assert.equal(fakes.calls.post.length, 1);
  assert.equal(fakes.calls.post[0].path, `/patients/${PATIENT}/readings`);
  assert.equal(first, second);
  assert.equal(fakes.calls.demoSave, 0, 'en sesión backend no se guarda copia en demo-store');
});

test('create informa REQUIRES_CONFIRMATION con sus motivos', async () => {
  fakes.replyPost({ readingId: 'r-2', status: 'REQUIRES_CONFIRMATION', confirmationReasons: ['Motivo A'] });
  const result = await readings.readingsService.create(PATIENT, bloodPressureRequest());
  assert.deepEqual(result, { readingId: 'r-2', status: 'REQUIRES_CONFIRMATION', confirmationReasons: ['Motivo A'] });
});

test('confirm usa patientId y readingId en la ruta y deja la lectura PENDING', async () => {
  fakes.calls.post.length = 0;
  fakes.replyPost({ readingId: 'r 2/x' }); // sin status: se representa como PENDING
  const result = await readings.readingsService.confirm(PATIENT, 'r 2/x');
  assert.equal(fakes.calls.post[0].path, `/patients/${PATIENT}/readings/r%202%2Fx/confirm`);
  assert.equal(result.status, 'PENDING');
});

test('confirm rechaza una respuesta de otra lectura', async () => {
  fakes.replyPost({ readingId: 'otra', status: 'PENDING' });
  await assert.rejects(readings.readingsService.confirm(PATIENT, 'r-3'), { code: 'INVALID_API_RESPONSE' });
});

test('errores de confirmación: READING_NOT_FOUND y READING_NOT_PENDING_CONFIRMATION', () => {
  assert.equal(readings.confirmReadingErrorFrom(apiError('READING_NOT_FOUND', 404)).kind, 'not_found');
  assert.equal(readings.confirmReadingErrorFrom(apiError('READING_NOT_PENDING_CONFIRMATION', 409)).kind, 'not_pending');
  assert.equal(readings.confirmReadingErrorFrom(apiError('SERVER_ERROR', 500)).kind, 'other');
});

test('los errores 422 de registro se asignan al campo correspondiente', () => {
  const request = bloodPressureRequest();
  const fieldsOf = (code, details) => Object.keys(readingErrorsFromApi(apiError(code, 422, details), request).fields);
  assert.deepEqual(fieldsOf('OUT_OF_RANGE', { parameterCode: 'SBP' }), ['SBP']);
  assert.deepEqual(fieldsOf('INVALID_UNIT', { detail: { parameterCode: 'DBP' } }), ['DBP']);
  assert.deepEqual(fieldsOf('DUPLICATED_PARAMETER', { index: 2 }), ['HEART_RATE']);
  assert.deepEqual(fieldsOf('INCOMPLETE_BLOOD_PRESSURE'), ['SBP', 'DBP']);
  assert.deepEqual(fieldsOf('CONTEXT_REQUIRED'), ['context']);
  assert.deepEqual(fieldsOf('FUTURE_DATE'), ['measuredAt']);
  const unknown = readingErrorsFromApi(apiError('UNKNOWN_PARAMETER', 422), request);
  assert.ok(unknown.general, 'sin parámetro identificable se muestra como error general');
});

test('errores con el formato real del backend ({ detail, errorCode }) también van al campo', () => {
  const request = bloodPressureRequest();
  // domicilia no envía parameterCode: el parámetro solo aparece en el texto de `detail`.
  const real = (code, detail) => readingErrorsFromApi(apiError(code, 422, {}, detail), request);

  const range = real('OUT_OF_RANGE', 'SBP = 400.0 no es posible (40–300 mmHg)');
  assert.deepEqual(Object.keys(range.fields), ['SBP']);
  assert.match(range.fields.SBP, /40–300 mmHg/);

  assert.deepEqual(Object.keys(real('INVALID_UNIT', 'HEART_RATE se registra en bpm').fields), ['HEART_RATE']);
  assert.deepEqual(Object.keys(real('UNKNOWN_PARAMETER', 'Parámetro desconocido: DBP').fields), ['DBP']);

  const duplicated = { ...request, measurements: [...request.measurements, request.measurements[0]] };
  const dup = readingErrorsFromApi(apiError('DUPLICATED_PARAMETER', 422, {}, 'Un parámetro aparece dos veces en la lectura'), duplicated);
  assert.deepEqual(Object.keys(dup.fields), ['SBP']);

  // Un código que no viene en la lectura no se asigna a un campo equivocado.
  assert.ok(real('UNKNOWN_PARAMETER', 'Parámetro desconocido: GLUCOSE').general);
});

test('patientId activo: el paciente usa su id; el cuidador, el paciente seleccionado', () => {
  try {
    fakes.setRole('PATIENT');
    assert.equal(readings.resolveActivePatientId(), PATIENT);

    fakes.setRole('CAREGIVER');
    fakes.selectPatient(null);
    assert.throws(() => readings.resolveActivePatientId(), { code: 'PATIENT_REQUIRED' });

    fakes.selectPatient({ id: 'paciente-vinculado-1', name: 'Rosa', email: '' });
    assert.equal(readings.resolveActivePatientId(), 'paciente-vinculado-1');
  } finally {
    fakes.setRole('PATIENT');
    fakes.selectPatient(null);
  }
});
