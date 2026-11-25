/* global mockModule, projectRequire */
'use strict';
/** Pruebas nuevas de P6 contra la caché real de src/, sin conexión de red. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { ApiError } = projectRequire('src/core/infrastructure/http/errors/api-error.ts');
let revision = 1;
let calls = [];
let handler = async () => ({ ok: true });
mockModule('src/core/infrastructure/http/api-client.ts', {
  apiSessionRevision: () => revision,
  apiClient: {
    get: (path, options) => {
      calls.push({ path, options });
      return handler(path, options);
    },
  },
});
const { dataClient } = projectRequire('src/core/infrastructure/http/data/data-client.ts');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const response = (value) => ({ value });
function reset() {
  revision++;
  dataClient.clearCache();
  calls = [];
  let next = 0;
  handler = async () => response(++next);
}

test('P6: la caché distingue pacientes y reutiliza el GET del mismo paciente', async () => {
  reset();
  const routeA = `/patients/${A}/readings`;
  const routeB = `/patients/${B}/readings`;
  assert.equal((await dataClient.get(routeA, { retry: false })).value, 1);
  assert.equal((await dataClient.get(routeB, { retry: false })).value, 2);
  assert.equal((await dataClient.get(routeA, { retry: false })).value, 1);
  assert.equal(calls.length, 2);
});

test('P6: página, filtros y claves manuales no colisionan', async () => {
  reset();
  const path = `/patients/${A}/readings`;
  const query = { page: 1, size: 20, parameterCode: 'SBP' };
  assert.equal((await dataClient.get(path, { retry: false, query })).value, 1);
  assert.equal((await dataClient.get(path, { retry: false, query: { parameterCode: 'SBP', size: 20, page: 1 } })).value, 1);
  assert.equal((await dataClient.get(path, { retry: false, query: { ...query, page: 2 } })).value, 2);
  assert.equal((await dataClient.get(path, { retry: false, query, cache: { key: 'shared' } })).value, 3);
  assert.equal((await dataClient.get(`/patients/${B}/readings`, { retry: false, query, cache: { key: 'shared' } })).value, 4);
  assert.equal(calls.length, 4);
});

test('P6: cambiar de sesión no reutiliza datos anteriores', async () => {
  reset();
  await dataClient.get('/notifications', { retry: false });
  assert.equal(calls.length, 1);
  revision++;
  const newer = await dataClient.get('/notifications', { retry: false });
  assert.equal(newer.value, 2);
  assert.equal(calls.length, 2);
});

test('P6: invalidar un paciente conserva la caché de otros pacientes', async () => {
  reset();
  await dataClient.get(`/patients/${A}/readings`, { retry: false });
  await dataClient.get(`/patients/${A}/readings`, { retry: false, query: { page: 2 } });
  await dataClient.get(`/patients/${B}/readings`, { retry: false });
  dataClient.invalidatePatient(A);
  assert.equal((await dataClient.get(`/patients/${A}/readings`, { retry: false })).value, 4);
  assert.equal((await dataClient.get(`/patients/${B}/readings`, { retry: false })).value, 3);
  assert.equal(calls.length, 4);
});

test('P6: forceRefresh vuelve al backend aun con la caché fresca', async () => {
  reset();
  await dataClient.get('/health', { auth: false, retry: false });
  assert.equal((await dataClient.get('/health', { auth: false, retry: false, cache: { forceRefresh: true } })).value, 2);
  assert.equal(calls.length, 2);
});

test('P6: una consulta duplicada en vuelo se comparte', async () => {
  reset();
  let finish;
  handler = () => new Promise((resolve) => { finish = resolve; });
  const a = dataClient.get('/same', { auth: false, retry: false });
  const b = dataClient.get('/same', { auth: false, retry: false });
  assert.equal(calls.length, 1);
  finish(response('ok'));
  assert.deepEqual(await a, await b);
});

test('P6: un 403 no publica datos obsoletos aunque se habilite staleIfError', async () => {
  reset();
  await dataClient.get('/clinical', { retry: false, cache: { ttlMs: 0 } });
  handler = async () => { throw new ApiError({ code: 'FORBIDDEN', status: 403, message: 'Sin acceso' }); };
  await assert.rejects(dataClient.get('/clinical', {
    retry: false, cache: { staleIfErrorMs: 5000 },
  }), (error) => error.status === 403);
  assert.equal(dataClient.cacheSize(), 0);
});

test('P6: sin opt-in, un 503 no devuelve datos caducados', async () => {
  reset();
  await dataClient.get('/sensitive', { retry: false, cache: { ttlMs: 0 } });
  handler = async () => { throw new ApiError({ code: 'BACKEND_DOWN', status: 503, message: 'Temporal' }); };
  await assert.rejects(dataClient.get('/sensitive', { retry: false }), (error) => error.status === 503);
});

test('P6: cambio de sesión durante el GET descarta respuesta tardía', async () => {
  reset();
  let finish;
  handler = () => new Promise((resolve) => { finish = resolve; });
  const pending = dataClient.get(`/patients/${A}/readings`, { retry: false });
  revision++;
  finish(response('privado'));
  await assert.rejects(pending, (error) => error.code === 'SESSION_CHANGED');
});
