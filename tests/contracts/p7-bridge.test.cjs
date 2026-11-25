/* global mockModule, projectRequire */
'use strict';
/** Contrato P7 sobre src/, sin red y sin datos clínicos reales. */
const test = require('node:test');
const assert = require('node:assert/strict');

const PATIENT = '11111111-1111-4111-8111-111111111111';
const CAREGIVER = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const HEALTH = { status: 'ok', servicios: {
  identidad: 'ok', relaciones: 'ok', seguimiento: 'ok', evaluacion: 'ok',
  atencion: 'ok', notificaciones: 'ok', auditoria: 'ok',
} };
const PATIENT_USER = { id: PATIENT, roles: ['PATIENT'] };
const CAREGIVER_USER = { id: CAREGIVER, roles: ['CAREGIVER'] };
const relation = (permissions = ['MEASUREMENT_VIEW','PATIENT_PROFILE_VIEW']) => ({
  patientId: PATIENT, permissions,
});
let calls = [];
let handler = async (path) => {
  if (path === '/health') return HEALTH;
  if (path === '/me') return PATIENT_USER;
  if (path === `/patients/${PATIENT}`) return { id: PATIENT };
  if (path === `/patients/${PATIENT}/readings`) return { total: 1, items: [{ readingId: OTHER }] };
  throw new Error(`Ruta no simulada: ${path}`);
};
let cacheRequests = [];
mockModule('src/core/infrastructure/http/api-client.ts', {
  apiClient: { get: async (route, options) => {
    calls.push({ route, options });
    return handler(route, options);
  } },
});
mockModule('src/core/infrastructure/http/data/index.ts', {
  dataClient: { get: async (route, options) => {
    cacheRequests.push({ route, options });
    return HEALTH;
  } },
});
const { verifyP7Integration } = projectRequire('src/core/infrastructure/http/integration-check.ts');
const { gatewayService } = projectRequire('src/core/infrastructure/http/gateway.ts');
const { ApiError } = projectRequire('src/core/infrastructure/http/errors/api-error.ts');

function context(user = PATIENT_USER, selectedPatientId = null, current = () => true) {
  return { userId: user.id, roles: user.roles, selectedPatientId, isCurrent: current };
}
function defaultResponse(path) {
  if (path === '/health') return HEALTH;
  if (path === '/me') return PATIENT_USER;
  if (path === '/me/patients') return [relation()];
  if (path === `/patients/${PATIENT}`) return { id: PATIENT };
  if (path === `/patients/${PATIENT}/readings`) return { total: 1, items: [{ readingId: OTHER }] };
  throw new Error(`Ruta no simulada: ${path}`);
}
function prepare(response = defaultResponse) { calls = []; handler = response; }
function status(report, key) { return report.steps.find(step => step.key === key)?.status; }

// Los casos tienen estado independiente y no escriben datos clínicos.
test('P7: sin sesión real ni identidad no efectúa peticiones HTTP', async () => {
  prepare();
  const report = await verifyP7Integration({ userId: null, roles: [], selectedPatientId: null, isCurrent: () => true });
  assert.equal(report.ready, false);
  assert.deepEqual(report.steps.map(s => s.key), ['identity']);
  assert.deepEqual(calls, []);
});

test('P7: paciente comprueba health, /me, ficha e historial sin vínculos de cuidador', async () => {
  prepare();
  const report = await verifyP7Integration(context());
  assert.equal(report.ready, true);
  assert.deepEqual(report.steps.map(s => s.key), ['gateway','identity','patients','profile','readings']);
  assert.ok(report.steps.every(s => s.status === 'ok'));
  assert.deepEqual(calls.map(c => c.route), [
    '/health', '/me', `/patients/${PATIENT}`, `/patients/${PATIENT}/readings`,
  ]);
  assert.equal(calls[0].options.auth, false, 'health es un endpoint público');
  assert.deepEqual(calls[3].options.query, { page: 1, size: 1 });
  assert.equal(calls.some(c => c.route === '/me/patients'), false);
});

test('P7: health del Gateway permite forceRefresh y prohíbe datos stale', async () => {
  cacheRequests = [];
  await gatewayService.health({ forceRefresh: true });
  await gatewayService.health({ forceRefresh: true });
  assert.equal(cacheRequests.length, 2);
  for (const call of cacheRequests) {
    assert.equal(call.route, '/health');
    assert.equal(call.options.auth, false);
    assert.equal(call.options.cache.forceRefresh, true);
    assert.equal(call.options.cache.staleIfErrorMs, 0);
    assert.ok(call.options.timeoutMs > 0);
  }
});

test('P7: cuidador sin paciente seleccionado no se asigna el primero', async () => {
  prepare(path => path === '/me' ? CAREGIVER_USER : defaultResponse(path));
  const report = await verifyP7Integration(context(CAREGIVER_USER));
  assert.equal(report.ready, false);
  assert.equal(status(report, 'patients'), 'warning');
  assert.equal(status(report, 'profile'), 'warning');
  assert.equal(status(report, 'readings'), 'warning');
  assert.deepEqual(calls.map(c => c.route), ['/health','/me','/me/patients']);
});

test('P7: cuidador con selección y permisos vigentes puede consultar perfil e historial', async () => {
  prepare(path => path === '/me' ? CAREGIVER_USER : defaultResponse(path));
  const report = await verifyP7Integration(context(CAREGIVER_USER, PATIENT));
  assert.equal(report.ready, true);
  assert.ok(report.steps.every(s => s.status === 'ok'));
  assert.deepEqual(calls.map(c => c.route), [
    '/health', '/me', '/me/patients', `/patients/${PATIENT}`, `/patients/${PATIENT}/readings`,
  ]);
});

test('P7: un vínculo sin MEASUREMENT_VIEW no solicita historial', async () => {
  prepare(path => {
    if (path === '/me') return CAREGIVER_USER;
    if (path === '/me/patients') return [relation(['PATIENT_PROFILE_VIEW'])];
    return defaultResponse(path);
  });
  const report = await verifyP7Integration(context(CAREGIVER_USER, PATIENT));
  assert.equal(report.ready, false);
  assert.equal(status(report, 'profile'), 'ok');
  assert.equal(status(report, 'readings'), 'warning');
  assert.equal(calls.some(c => c.route.endsWith('/readings')), false);
});

test('P7: un vínculo sin PATIENT_PROFILE_VIEW no solicita ficha', async () => {
  prepare(path => {
    if (path === '/me') return CAREGIVER_USER;
    if (path === '/me/patients') return [relation(['MEASUREMENT_VIEW'])];
    return defaultResponse(path);
  });
  const report = await verifyP7Integration(context(CAREGIVER_USER, PATIENT));
  assert.equal(report.ready, false);
  assert.equal(status(report, 'profile'), 'warning');
  assert.equal(status(report, 'readings'), 'ok');
  assert.equal(calls.some(c => c.route === `/patients/${PATIENT}`), false);
});

test('P7: Gateway degradado reporta error sin sustituir los datos con mocks', async () => {
  prepare(path => path === '/health'
    ? { status: 'degraded', servicios: { identidad: 'down' } }
    : defaultResponse(path));
  const report = await verifyP7Integration(context());
  assert.equal(report.ready, false);
  assert.equal(status(report, 'gateway'), 'error');
  assert.equal(status(report, 'readings'), 'ok');
});

test('P7: fallo HTTP 503 en Gateway se informa y no bloquea las comprobaciones independientes', async () => {
  prepare(path => {
    if (path === '/health') throw new ApiError({ code: 'SERVICE_UNAVAILABLE', status: 503, message: 'Gateway no disponible' });
    return defaultResponse(path);
  });
  const report = await verifyP7Integration(context());
  assert.equal(report.ready, false);
  assert.equal(status(report, 'gateway'), 'error');
  assert.equal(status(report, 'readings'), 'ok');
});

test('P7: sin lecturas reales informa pendiente y no inventa registros', async () => {
  prepare(path => path.endsWith('/readings') ? { total: 0, items: [] } : defaultResponse(path));
  const report = await verifyP7Integration(context());
  assert.equal(report.ready, false);
  assert.equal(status(report, 'readings'), 'warning');
});

test('P7: una respuesta clínica perteneciente a otro paciente se rechaza', async () => {
  prepare(path => path === `/patients/${PATIENT}` ? { id: OTHER } : defaultResponse(path));
  const report = await verifyP7Integration(context());
  assert.equal(report.ready, false);
  assert.equal(status(report, 'profile'), 'error');
});

test('P7: historial inválido no se interpreta como disponibilidad real', async () => {
  prepare(path => path.endsWith('/readings') ? { total: '1', items: [] } : defaultResponse(path));
  const report = await verifyP7Integration(context());
  assert.equal(report.ready, false);
  assert.equal(status(report, 'readings'), 'error');
});

test('P7: cambio de sesión mientras health responde descarta todo el informe', async () => {
  let release;
  let current = true;
  prepare(path => path === '/health' ? new Promise(resolve => { release = resolve; }) : defaultResponse(path));
  const pending = verifyP7Integration(context(PATIENT_USER, null, () => current));
  assert.equal(typeof release, 'function');
  current = false;
  release(HEALTH);
  const report = await pending;
  assert.equal(report.ready, false);
  assert.deepEqual(report.steps.map(s => s.key), ['identity']);
  assert.deepEqual(calls.map(c => c.route), ['/health']);
});

test('P7: una identidad /me distinta de la sesión activa no permite consultar información clínica', async () => {
  prepare(path => path === '/me' ? { id: OTHER, roles: ['PATIENT'] } : defaultResponse(path));
  const report = await verifyP7Integration(context());
  assert.equal(report.ready, false);
  assert.equal(status(report, 'identity'), 'error');
  assert.equal(calls.some(c => c.route.includes('/patients/')), false);
});

test('P7: cuenta demo no activa comprobación sin sesión backend', async () => {
  prepare();
  const report = await verifyP7Integration({ userId: null, roles: [], selectedPatientId: null, isCurrent: () => false });
  assert.equal(report.ready, false);
  assert.deepEqual(calls, []);
});
