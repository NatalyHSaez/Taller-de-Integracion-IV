/* global projectRequire */
/**
 * URLs reales del historial y del detalle (services/api.ts sin simular).
 * Se reemplaza solo fetch, así que se prueba la URL que sale hacia el gateway.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.EXPO_PUBLIC_API_URL = 'http://gateway.test';
const requests = [];
globalThis.fetch = async (url) => {
  requests.push(String(url));
  const body = String(url).includes('/readings/')
    ? { readingId: 'r9', patientId: 'p 1', measuredAt: '2026-11-06T12:00:00Z', status: 'PENDING', confirmationReasons: [], measurements: [] }
    : { total: 0, page: 2, size: 5, items: [] };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const api = projectRequire('services/api.ts');

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
