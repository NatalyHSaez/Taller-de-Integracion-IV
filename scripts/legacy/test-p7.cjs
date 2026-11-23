'use strict';
/** P7: contratos y camino Expo -> Gateway (fetch simulado; NO sustituye prueba Docker). */
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
const originalTs = Module._extensions['.ts'];
const originalFetch = global.fetch;
const originalDev = global.__DEV__;
Module._resolveFilename = function(request, parent, ...rest) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...rest);
};
Module._extensions['.ts'] = (mod, file) => {
  if (file === path.join(root, 'config/api.ts')) {
    mod.exports = { IS_API_CONFIGURED: true, API_V1_URL: 'http://p7.test/api/v1' }; return;
  }
  if (file === path.join(root, 'services/token-storage.ts')) {
    mod.exports = { getAccessToken: async () => null, getRefreshToken: async () => null,
      saveTokens: async () => {}, clearTokens: async () => {} }; return;
  }
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  mod._compile(out.outputText, file);
};
global.__DEV__ = false;
const { authSession } = require('../services/auth-session');
const { demo } = require('../services/demo-store');
const { patientAccess } = require('../services/patient-access');
const { dataClient } = require('../services/data');
const { verifyP7Integration } = require('../services/integration-check');
const { gatewayService } = require('../services/gateway');
const patient = '11111111-1111-4111-8111-111111111111';
const caregiver = '22222222-2222-4222-8222-222222222222';
const relationId = '33333333-3333-4333-8333-333333333333';
const tokens = { accessToken: 'p7-access', refreshToken: 'p7-refresh', tokenType: 'bearer', expiresIn: 3600 };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const responseHealth = { status: 'ok', servicios: Object.fromEntries(['identidad','relaciones','seguimiento','evaluacion','atencion','notificaciones','auditoria'].map(k => [k,'ok'])) };
const users = {
  patient: { id: patient, email: 'test-patient@example.org', fullName: 'Paciente', roles: ['PATIENT'] },
  caregiver: { id: caregiver, email: 'test-caregiver@example.org', fullName: 'Cuidador', roles: ['CAREGIVER'] },
};
function start(role) { authSession.startBackend(tokens, users[role]); }
function getRequest(url, init) {
  assert.match(url, /^http:\/\/p7\.test\/api\/v1\//);
  const route = url.replace('http://p7.test/api/v1','');
  if (route === '/health') return json(responseHealth);
  if (route === '/me') return json(authSession.user());
  if (route === '/me/patients') return json([{
    patientId: patient, fullName: 'Paciente', relationshipId: relationId, relationshipType: 'CAREGIVER',
    permissions: ['MEASUREMENT_VIEW','PATIENT_PROFILE_VIEW'], linkedAt: '2026-10-17T10:00:00Z',
  }]);
  if (route === `/patients/${patient}`) return json({ id: patient, fullName:'Paciente', birthDate:null, age:null, biologicalSex:null, managementMode:null });
  if (route.startsWith(`/patients/${patient}/readings?`)) return json({ total: 1, page:1, size:1, items: [{ readingId: relationId }] });
  throw new Error(`Ruta inesperada: ${route}, ${init?.method}`);
}
let count = 0;
async function test(label, callback) {
  patientAccess.clear(); authSession.clear(); demo.logout(); dataClient.clearCache();
  global.fetch = async () => { throw new Error('No debería consultar la red.'); };
  try { await callback(); count++; console.log('OK', label); }
  catch (e) { console.error('FALLÓ', label); throw e; }
}
(async () => {
  await test('Sin sesión no consulta la API', async () => {
    const report = await verifyP7Integration();
    assert.equal(report.ready, false); assert.equal(report.steps.length,1);
  });
  await test('Paciente real: health, /me, ficha e historial disponibles', async () => {
    start('patient'); const paths = [];
    global.fetch = async (url, init) => { paths.push(url); return getRequest(url, init); };
    const result = await verifyP7Integration();
    assert.equal(result.ready, true, JSON.stringify(result.steps));
    assert.equal(paths.filter(p => p.endsWith('/me/patients')).length, 0);
    assert.deepEqual(result.steps.map(step=>step.status),['ok','ok','ok','ok','ok']);
  });
  await test('Health fresco no usa caché previa', async () => {
    start('patient'); let countRequests = 0;
    global.fetch = async () => { countRequests++; return json(responseHealth); };
    await gatewayService.healthFresh(); await gatewayService.healthFresh();
    assert.equal(countRequests,2);
  });
  await test('Cuidador sin selección ve advertencia, nunca selecciona automáticamente', async () => {
    start('caregiver'); global.fetch = getRequest;
    const report = await verifyP7Integration();
    assert.equal(report.ready, false); assert.equal(report.steps.find(s => s.key === 'patients').status,'warning');
    assert.equal(patientAccess.snapshot().selectedId,null);
  });
  await test('Cuidador con selección vigente valida permiso, perfil e historial', async () => {
    start('caregiver'); global.fetch = getRequest;
    await patientAccess.select(patient);
    const report = await verifyP7Integration();
    assert.equal(report.ready, true, JSON.stringify(report.steps));
  });
  await test('Error 503 en Gateway visible, sin datos demo', async () => {
    start('patient'); global.fetch = (url, init) => url.endsWith('/health') ? json({ detail:'Servicio caído', errorCode:'SERVICE_UNAVAILABLE' },503) : getRequest(url, init);
    const report = await verifyP7Integration();
    assert.equal(report.ready,false); assert.equal(report.steps[0].status,'error');
    assert.ok(report.steps.some(s=>s.key==='readings' && s.status==='ok'));
  });
  await test('Sin lecturas reales deja P7 pendiente, sin inventar registros', async () => {
    start('patient'); global.fetch = (url, init) =>
      url.includes('/readings?') ? Promise.resolve(json({ total: 0, page: 1, size: 1, items: [] }))
        : Promise.resolve(getRequest(url, init));
    const report = await verifyP7Integration();
    assert.equal(report.ready, false);
    assert.equal(report.steps.find(s => s.key === 'readings').status, 'warning');
  });
  await test('Un cambio de sesión durante P7 invalida el resultado', async () => {
    start('patient'); let release;
    global.fetch = (url, init) => {
      if (url.endsWith('/health')) return new Promise(resolve => { release = resolve; });
      return Promise.resolve(getRequest(url, init));
    };
    const pending = verifyP7Integration();
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(release);
    authSession.clear();
    release(json(responseHealth));
    const result = await pending;
    assert.equal(result.ready, false);
  });
  await test('Modo mock jamás ejecuta diagnóstico real', async () => {
    authSession.startMock(tokens, users.patient);
    const report = await verifyP7Integration();
    assert.equal(report.ready,false); assert.equal(report.steps[0].key,'identity');
  });
  console.log(`\n${count} comprobaciones P7 correctas (HTTP simulado).`);
})().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => {
    Module._resolveFilename = originalResolve;
    Module._extensions['.ts'] = originalTs;
    global.fetch = originalFetch;
    global.__DEV__ = originalDev;
  });
