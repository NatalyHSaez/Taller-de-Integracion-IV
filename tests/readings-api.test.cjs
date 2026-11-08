/* global projectRequire */
/**
 * URLs reales del historial y del detalle (services/api.ts sin simular).
 * Se reemplaza solo fetch, así que se prueba la URL que sale hacia el gateway.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.EXPO_PUBLIC_API_URL = 'http://gateway.test';
const requests = [];
const sent = [];
globalThis.fetch = async (url, init = {}) => {
  requests.push(String(url));
  sent.push({ url: String(url), method: init.method ?? 'GET', body: init.body });
  if (init.method === 'DELETE') {
    // 204 sin cuerpo: si se intentara leer JSON, fallaría.
    return { status: 204, ok: true, headers: new Headers(), json: () => { throw new Error('no se debe leer JSON en 204'); }, text: () => { throw new Error('no se debe leer el cuerpo en 204'); } };
  }
  const body = String(url).includes('/readings/')
    ? { readingId: 'r9', patientId: 'p 1', measuredAt: '2026-11-06T12:00:00Z', status: 'PENDING', confirmationReasons: [], measurements: [] }
    : { total: 0, page: 2, size: 5, items: [] };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const api = {
  ...projectRequire('src/core/infrastructure/http/api-client.ts'),
  ...projectRequire('src/modules/identity/infrastructure/identity-api.ts'),
  ...projectRequire('src/modules/relationships/infrastructure/relationships-api.ts'),
  ...projectRequire('src/modules/monitoring/infrastructure/readings-api.ts'),
};

test('GET /patients/{id}/readings con page, size, parameterCode, from y to', async () => {
  await api.getPatientReadings('p 1', {
    page: 2,
    size: 5,
    parameterCode: 'SBP',
    from: '2026-11-01T03:00:00.000Z',
    to: '2026-11-06T12:00:00.000Z',
  });
  const url = new URL(requests.at(-1));
  assert.equal(url.pathname, '/api/v1/patients/p%201/readings');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    page: '2',
    size: '5',
    parameterCode: 'SBP',
    from: '2026-11-01T03:00:00.000Z',
    to: '2026-11-06T12:00:00.000Z',
  });
});

test('los filtros vacíos no se envían', async () => {
  await api.getPatientReadings('p1', { page: 1, size: 20 });
  const url = new URL(requests.at(-1));
  assert.deepEqual([...url.searchParams.keys()], ['page', 'size']);
});

test('el detalle se pide por el readingId real', async () => {
  const reading = await api.getPatientReading('p 1', 'r9');
  assert.equal(new URL(requests.at(-1)).pathname, '/api/v1/patients/p%201/readings/r9');
  assert.equal(reading.readingId, 'r9');
});

test('ficha: GET /patients/{patientId} con el id codificado', async () => {
  requests.length = 0;
  await api.getPatient('p 1');
  assert.equal(requests[0], 'http://gateway.test/api/v1/patients/p%201');
});

test('vínculos: GET /patients/{patientId}/caregivers y /doctors', async () => {
  requests.length = 0;
  await Promise.allSettled([api.getPatientCaregivers('p 1'), api.getPatientDoctors('p 1')]);
  assert.deepEqual(requests.sort(), [
    'http://gateway.test/api/v1/patients/p%201/caregivers',
    'http://gateway.test/api/v1/patients/p%201/doctors',
  ]);
});

test('desvinculación: DELETE 204 se procesa sin leer JSON (cuidador y médico)', async () => {
  sent.length = 0;
  assert.equal(await api.revokeCaregiverRelationship('rel 1'), undefined);
  assert.equal(await api.revokeDoctorRelationship('rel 2'), undefined);
  assert.deepEqual(sent.map((r) => [r.method, r.url]), [
    ['DELETE', 'http://gateway.test/api/v1/caregiver-relationships/rel%201'],
    ['DELETE', 'http://gateway.test/api/v1/doctor-relationships/rel%202'],
  ]);
});

test('permisos: PUT con el conjunto completo', async () => {
  sent.length = 0;
  await api.updateCaregiverPermissions('rel 1', ['PATIENT_PROFILE_VIEW', 'ALERT_VIEW']).catch(() => {});
  assert.equal(sent[0].method, 'PUT');
  assert.equal(sent[0].url, 'http://gateway.test/api/v1/caregiver-relationships/rel%201/permissions');
  assert.deepEqual(JSON.parse(sent[0].body), { permissions: ['PATIENT_PROFILE_VIEW', 'ALERT_VIEW'] });
});

test('códigos: POST /patients/{id}/link-codes con CAREGIVER o DOCTOR y POST /link-codes/consume', async () => {
  sent.length = 0;
  await api.createPatientLinkCode('p 1', 'DOCTOR').catch(() => {});
  await api.createPatientLinkCode('p 1').catch(() => {});
  await api.consumeLinkCode('AB12CD').catch(() => {});
  assert.deepEqual(sent.map((r) => [r.method, r.url, JSON.parse(r.body)]), [
    ['POST', 'http://gateway.test/api/v1/patients/p%201/link-codes', { type: 'DOCTOR' }],
    ['POST', 'http://gateway.test/api/v1/patients/p%201/link-codes', { type: 'CAREGIVER' }],
    ['POST', 'http://gateway.test/api/v1/link-codes/consume', { code: 'AB12CD' }],
  ]);
});
