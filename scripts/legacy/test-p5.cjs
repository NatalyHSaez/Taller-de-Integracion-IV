// P5: tests de relaciones reales y aislamiento, sin red ni Expo Go.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
const originalExt = Module._extensions['.ts'];
const originalFetch = global.fetch;
let checks = 0;
Module._resolveFilename = function (request, parent, ...rest) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...rest);
};
Module._extensions['.ts'] = function (mod, filename) {
  if (filename === path.join(root, 'config/api.ts')) {
    mod.exports = { API_V1_URL: 'https://p5.test/api/v1', IS_API_CONFIGURED: true };
    return;
  }
  if (filename === path.join(root, 'services/token-storage.ts')) {
    mod.exports = { getRefreshToken: async () => null, getAccessToken: async () => null,
      saveTokens: async () => {}, clearTokens: async () => {} };
    return;
  }
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  mod._compile(result.outputText, filename);
};
global.__DEV__ = false;
const { authSession } = require('../services/auth-session');
const { demo } = require('../services/demo-store');
const { patientAccess } = require('../services/patient-access');
const { appState } = require('../services/app-state');
const { dataClient } = require('../services/data');
const { authService } = require('../services/authservice');
const patient1 = '11111111-1111-4111-8111-111111111111';
const patient2 = '22222222-2222-4222-8222-222222222222';
const caregiver = '33333333-3333-4333-8333-333333333333';
const rel1 = '44444444-4444-4444-8444-444444444444';
const rel2 = '55555555-5555-4555-8555-555555555555';
const tokens = { accessToken: 'p5-access', refreshToken: 'p5-refresh', tokenType: 'bearer', expiresIn: 900 };
const users = {
  caregiver: { id: caregiver, fullName: 'Cuidador Real', email: 'care@test.cl', roles: ['CAREGIVER'] },
  patient: { id: patient1, fullName: 'Paciente Real', email: 'pat@test.cl', roles: ['PATIENT'] },
};
const link = (patientId, relationshipId, permissions) => ({ patientId, relationshipId,
  fullName: patientId === patient1 ? 'Paciente Uno' : 'Paciente Dos', relationshipType: 'CAREGIVER',
  permissions, linkedAt: '2026-10-28T12:00:00Z' });
const first = link(patient1, rel1, ['PATIENT_PROFILE_VIEW', 'MEASUREMENT_VIEW']);
const second = link(patient2, rel2, ['MEASUREMENT_CREATE', 'ALERT_VIEW']);
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
async function reset() {
  authSession.clear(); patientAccess.clear(); demo.logout(); dataClient.clearCache();
  global.fetch = async (url) => { throw new Error('Unexpected network request: ' + url); };
}
function asCaregiver() { authSession.startBackend(tokens, users.caregiver); demo.startBackendSession(users.caregiver); }
function asPatient() { authSession.startBackend(tokens, users.patient); demo.startBackendSession(users.patient); }
async function check(label, fn) { await reset(); try { await fn(); console.log('OK', label); checks++; } catch (err) { console.error('FAIL', label); throw err; } }
async function main() {
  await check('PATIENT usa su propio UUID y no consume me/patients', async () => {
    asPatient(); const state = appState.snapshot();
    assert.equal(state.selectedPatient.id, patient1);
    assert.deepEqual(state.patients.map(x => x.id), [patient1]);
    assert.deepEqual(state.permissions, { read: true, write: true, alerts: true, profile: true });
  });
  await check('Cuidador sin relaciones no recibe pacientes ni permisos mock', async () => {
    asCaregiver(); const before = appState.snapshot();
    assert.deepEqual(before.patients, []); assert.equal(before.selectedPatient, null);
    assert.equal(before.permissions.read, false);
    global.fetch = async (url) => { assert.match(url, /\/me\/patients$/); return json([]); };
    await patientAccess.ensureLoaded(); assert.equal(appState.snapshot().patients.length, 0);
  });
  await check('GET /me/patients trae dos UUID y permisos por relación', async () => {
    asCaregiver(); const seen = [];
    global.fetch = async (url, req) => { seen.push([url, req.headers.get('Authorization')]); return json([first, second]); };
    await patientAccess.ensureLoaded();
    const state = appState.snapshot(); assert.deepEqual(state.patients.map(p => p.id), [patient1, patient2]);
    assert.equal(state.selectedPatient, null); assert.equal(seen[0][1], 'Bearer p5-access');
  });
  await check('Selección siempre revalida y no concede permisos de otra relación', async () => {
    asCaregiver(); let requests = 0;
    global.fetch = async () => { requests++; return json([first, second]); };
    await patientAccess.ensureLoaded(); await patientAccess.select(patient1);
    let current = appState.snapshot(); assert.equal(current.selectedPatient.id, patient1);
    assert.equal(current.permissions.read, true); assert.equal(current.permissions.alerts, false);
    await patientAccess.select(patient2); current = appState.snapshot();
    assert.equal(current.selectedPatient.id, patient2); assert.equal(current.permissions.read, false);
    assert.equal(current.permissions.write, true); assert.equal(current.permissions.alerts, true);
    assert.ok(requests >= 3);
  });
  await check('El backend elimina vínculo: selección, permisos y caché se vacían', async () => {
    asCaregiver(); let list = [first];
    global.fetch = async () => json(list);
    await patientAccess.ensureLoaded(); await patientAccess.select(patient1);
    assert.equal(appState.snapshot().permissions.read, true);
    list = []; await patientAccess.refresh();
    assert.equal(appState.snapshot().selectedPatient, null);
    assert.equal(appState.snapshot().permissions.read, false);
    assert.equal(patientAccess.snapshot().patients.length, 0);
  });
  await check('403 del backend no permite reutilizar listado anterior', async () => {
    asCaregiver(); let allowed = true;
    global.fetch = async () => allowed ? json([first]) : json({ detail: 'No autorizado', errorCode: 'FORBIDDEN' }, 403);
    await patientAccess.ensureLoaded(); await patientAccess.select(patient1);
    allowed = false;
    await assert.rejects(patientAccess.refresh(), (e) => e.status === 403 && e.code === 'FORBIDDEN');
    assert.deepEqual(appState.snapshot().patients, []);
    assert.equal(appState.snapshot().selectedPatient, null);
  });
  await check('503 no oculta el error ni devuelve un paciente de demo', async () => {
    asCaregiver();
    global.fetch = async () => json({ detail: 'Sin respuesta', errorCode: 'AUTHORIZATION_UNAVAILABLE' }, 503);
    await assert.rejects(patientAccess.ensureLoaded(), e => e.status === 503);
    assert.equal(appState.snapshot().selectedPatient, null);
    assert.ok(patientAccess.snapshot().error);
  });
  await check('Respuesta tardía no revive otra sesión', async () => {
    asCaregiver(); let finish;
    global.fetch = () => new Promise(resolve => { finish = resolve; });
    const waiting = patientAccess.refresh();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(typeof finish, 'function');
    authSession.clear(); patientAccess.clear(); dataClient.clearCache();
    finish(json([first]));
    await assert.rejects(waiting, e => e.code === 'SESSION_CHANGED');
    assert.equal(appState.snapshot().user, null);
  });
  await check('No selecciona paciente inexistente o ID inválido', async () => {
    asCaregiver(); global.fetch = async () => json([first]);
    await assert.rejects(patientAccess.select('no-es-uuid'), e => e.code === 'INVALID_PATIENT_ID');
    await assert.rejects(patientAccess.select(patient2), e => e.status === 403);
  });
  await check('Ficha exige permiso de perfil y seleccion correcta', async () => {
    asCaregiver(); let list = [second];
    global.fetch = async () => json(list);
    await patientAccess.ensureLoaded(); await patientAccess.select(patient2);
    await assert.rejects(patientAccess.getProfile(patient2), e => e.status === 403);
  });
  await check('Ficha GET /patients/{id} con permiso y respuesta correcta', async () => {
    asCaregiver(); let calls = [];
    global.fetch = async (url) => { calls.push(url);
      if (url.endsWith('/me/patients')) return json([first]);
      if (url.endsWith('/patients/' + patient1)) return json({ id: patient1, fullName: 'Paciente Uno', birthDate: null, age: null, biologicalSex: null, managementMode: null });
      throw Error(url);
    };
    await patientAccess.ensureLoaded(); await patientAccess.select(patient1);
    const profile = await patientAccess.getProfile(patient1);
    assert.equal(profile.id, patient1); assert.ok(calls.some(x => x.endsWith('/patients/' + patient1)));
  });
  await check('El modo mock conserva sus propios pacientes y no hace fetch', async () => {
    authSession.startMock(tokens, { id: 'demo', fullName: 'demo', email: 'demo@demo', roles: ['PATIENT'] });
    demo.login('demopaciente@gmail.com', '123456');
    const state = appState.snapshot(); assert.equal(state.sessionMode, 'mock');
    assert.equal(state.selectedPatient.id, 'demo-patient-gmail');
    await appState.selectPatient('demo-patient-gmail');
    assert.equal(appState.snapshot().hasSelectedPatient, true);
  });
  await check('Logout deja permisos y selección vacíos', async () => {
    asCaregiver(); global.fetch = async () => json([first]);
    await patientAccess.ensureLoaded(); await patientAccess.select(patient1);
    await authService.logout();
    assert.equal(appState.snapshot().user, null); assert.equal(appState.snapshot().selectedPatient, null);
  });
  console.log(`\n${checks} comprobaciones P5 correctas.`);
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch; Module._resolveFilename = originalResolve;
  Module._extensions['.ts'] = originalExt;
});
