// Ejecutar desde la raíz: node scripts/test-p4.cjs
// Prueba los módulos TS reales con red simulada y almacén SecureStore en memoria.
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
const originalTs = Module._extensions['.ts'];
const originalFetch = global.fetch;
const oldDev = global.__DEV__;
const saved = { access: null, refresh: null };
let checks = 0;
const configPath = path.join(root, 'config/api.ts');
const storagePath = path.join(root, 'services/token-storage.ts');
Module._resolveFilename = function (request, parent, ...rest) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...rest);
};
Module._extensions['.ts'] = function (module, filename) {
  if (filename === configPath) {
    module.exports = { API_V1_URL: 'https://gateway.test/api/v1', IS_API_CONFIGURED: true };
    return;
  }
  if (filename === storagePath) {
    module.exports = {
      getAccessToken: async () => saved.access,
      getRefreshToken: async () => saved.refresh,
      saveTokens: async (access, refresh) => { saved.access = access; saved.refresh = refresh; },
      clearTokens: async () => { saved.access = null; saved.refresh = null; },
    };
    return;
  }
  const transpiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  module._compile(transpiled.outputText, filename);
};
global.__DEV__ = false;
const { authService } = require('../services/authservice');
const { apiClient } = require('../services/api');
const { authSession } = require('../services/auth-session');
const { demo } = require('../services/demo-store');
const { dataClient } = require('../services/data');
const id = '11111111-1111-4111-8111-111111111111';
const patient = { id, fullName: 'Paciente Backend', email: 'real@test.cl', roles: ['PATIENT'] };
const caregiver = { ...patient, roles: ['CAREGIVER'] };
const tok = (n) => ({ accessToken: `access-${n}`, refreshToken: `refresh-${n}`, tokenType: 'bearer', expiresIn: 3600 });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const noContent = () => new Response(null, { status: 204 });
async function reset() {
  global.fetch = async () => { throw Error('Unexpected HTTP request'); };
  await authService.logout();
  saved.access = null; saved.refresh = null;
  demo.logout();
  dataClient.clearCache();
}
async function check(name, run) {
  await reset();
  await run();
  checks++;
  console.log('OK', name);
}
function realSession(user = patient, n = 'old') {
  saved.access = `access-${n}`; saved.refresh = `refresh-${n}`;
  authSession.startBackend(tok(n), user);
  demo.startBackendSession(user);
}
async function main() {
  await check('Registro PATIENT exige fecha y usa camelCase', async () => {
    let body;
    global.fetch = async (url, req) => {
      assert.match(url, /\/auth\/register$/);
      body = JSON.parse(req.body);
      return json(patient, 201);
    };
    await authService.register({ fullName: patient.fullName, email: patient.email, password: 'pass123456', role: 'PATIENT', birthDate: '2000-01-02' });
    assert.deepEqual(body, { fullName: patient.fullName, email: patient.email, password: 'pass123456', role: 'PATIENT', birthDate: '2000-01-02' });
  });
  await check('Registro CAREGIVER sin fecha', async () => {
    global.fetch = async (_url, req) => {
      assert.equal(JSON.parse(req.body).role, 'CAREGIVER');
      assert.equal(JSON.parse(req.body).birthDate, undefined);
      return json(caregiver, 201);
    };
    await authService.register({ fullName: 'Cuidador', email: 'cuidador@test.cl', password: 'pass123456', role: 'CAREGIVER' });
  });
  await check('Login real /me, almacenamiento persistido y UUID del paciente', async () => {
    const seen = [];
    global.fetch = async (url, req) => {
      seen.push([url, req.headers.get('Authorization')]);
      if (url.endsWith('/auth/login')) return json(tok('one'));
      if (url.endsWith('/me')) return json(patient);
      throw Error(url);
    };
    await authService.login(patient.email, '12345678');
    assert.equal(saved.access, 'access-one');
    assert.equal(saved.refresh, 'refresh-one');
    assert.equal(authSession.user().id, id);
    assert.equal(demo.patient().id, id);
    assert.equal(demo.measurements().filter(x => x.patientId === id).length, 0);
    assert.deepEqual(seen.map(x => x[0].split('/').pop()), ['login', 'me']);
    assert.equal(seen[1][1], 'Bearer access-one');
  });
  await check('Modo mock explícito no consulta red ni persiste tokens', async () => {
    await authService.login('demopaciente@gmail.com', '123456', 'mock');
    assert.equal(authSession.mode(), 'mock');
    assert.equal(saved.access, null);
    assert.equal(authSession.accessToken(), null);
  });
  await check('Login backend NO usa mock automáticamente', async () => {
    global.fetch = async () => json({ detail: 'Credenciales inválidas' }, 401);
    await assert.rejects(authService.login('demopaciente@gmail.com', '123456'), e => e.status === 401);
    assert.equal(authSession.mode(), null);
  });
  await check('Restauración de sesión desde los tokens persistidos', async () => {
    saved.access = 'access-restore'; saved.refresh = 'refresh-restore';
    global.fetch = async (url, req) => {
      assert.ok(url.endsWith('/me')); assert.equal(req.headers.get('Authorization'), 'Bearer access-restore');
      return json(patient);
    };
    const user = await authService.restore();
    assert.equal(user.id, id);
    assert.equal(authSession.mode(), 'backend');
  });
  await check('Restauración con access expirado y refresh válido', async () => {
    saved.access = 'access-expired'; saved.refresh = 'refresh-expired';
    let renews = 0;
    global.fetch = async (url, req) => {
      if (url.endsWith('/auth/refresh')) {
        renews++; assert.equal(JSON.parse(req.body).refreshToken, 'refresh-expired');
        return json(tok('rotated'));
      }
      return req.headers.get('Authorization') === 'Bearer access-expired' ? json({ detail: 'Expired' }, 401) : json(patient);
    };
    await authService.restore();
    assert.equal(renews, 1); assert.equal(saved.refresh, 'refresh-rotated');
    assert.equal(authSession.user().id, id);
  });
  await check('Dos respuestas 401 rotan exactamente una vez el refresh token', async () => {
    realSession(); let renews = 0;
    global.fetch = async (url, req) => {
      if (url.endsWith('/auth/refresh')) {
        renews++;
        return new Promise(resolve => setTimeout(() => resolve(json(tok('new'))), 15));
      }
      const access = req.headers.get('Authorization');
      return access === 'Bearer access-old' ? json({ detail: 'Access expired' }, 401) : json({ ok: true });
    };
    const [a, b] = await Promise.all([apiClient.get('/patients/1'), apiClient.get('/patients/2')]);
    assert.deepEqual([a, b], [{ ok: true }, { ok: true }]);
    assert.equal(renews, 1);
    assert.equal(saved.refresh, 'refresh-new');
    assert.equal(authSession.user().id, id);
  });
  await check('Refresh 401 invalida sesión y elimina tokens', async () => {
    realSession();
    global.fetch = async url => url.endsWith('/auth/refresh') ? json({ detail: 'Invalid' }, 401) : json({ detail: 'Expired' }, 401);
    await assert.rejects(apiClient.get('/patients/1'), err => err.status === 401);
    assert.equal(authSession.user(), null);
    assert.equal(demo.user(), undefined);
    assert.equal(saved.access, null);
  });
  await check('Refresh 503 conserva tokens para reintento', async () => {
    realSession();
    global.fetch = async url => url.endsWith('/auth/refresh') ? json({ detail: 'Unavailable' }, 503) : json({ detail: 'Expired' }, 401);
    await assert.rejects(apiClient.get('/patients/1'), err => err.status === 503);
    assert.equal(saved.refresh, 'refresh-old');
    assert.equal(authSession.mode(), 'backend');
  });
  await check('PATCH /me actualiza usuario sin borrar la sesión', async () => {
    realSession();
    global.fetch = async (url, req) => {
      assert.ok(url.endsWith('/me'));
      assert.equal(req.method, 'PATCH');
      assert.deepEqual(JSON.parse(req.body), { fullName: 'Nombre Nuevo' });
      return json({ ...patient, fullName: 'Nombre Nuevo' });
    };
    await authService.updateName(' Nombre Nuevo ');
    assert.equal(authSession.user().fullName, 'Nombre Nuevo');
    assert.equal(authSession.refreshToken(), 'refresh-old');
  });
  await check('Logout revoca refresh y limpia sesión, aunque el backend falle', async () => {
    realSession();
    global.fetch = async (url, req) => {
      assert.ok(url.endsWith('/auth/logout'));
      assert.equal(JSON.parse(req.body).refreshToken, 'refresh-old');
      return json({ detail: 'Gateway unavailable' }, 503);
    };
    await authService.logout();
    assert.equal(authSession.mode(), null);
    assert.equal(saved.refresh, null);
    assert.equal(demo.user(), undefined);
  });
  await check('Refresh lento no resucita sesión cerrada', async () => {
    realSession(); let release;
    global.fetch = async (url) => {
      if (url.endsWith('/auth/refresh')) return new Promise(resolve => { release = resolve; });
      return json({ detail: 'Expired' }, 401);
    };
    const request = apiClient.get('/patients/1').catch(() => null);
    for (let i = 0; i < 10 && !release; i++) await new Promise(resolve => setTimeout(resolve, 0));
    assert.ok(release);
    await authService.logout();
    release(json(tok('should-not-restore')));
    await request;
    assert.equal(authSession.mode(), null);
    assert.equal(saved.refresh, null);
  });
  await check('Cuidador real no recibe relaciones ni pacientes ficticios', async () => {
    global.fetch = async url => url.endsWith('/auth/login') ? json(tok('caregiver')) : json(caregiver);
    await authService.login('cuidador@test.cl', '12345678');
    assert.equal(authSession.user().roles[0], 'CAREGIVER');
    assert.equal(demo.patients().length, 0);
    assert.equal(demo.patient(), undefined);
  });
  await check('Una respuesta tardía de /me no restaura una sesión cerrada', async () => {
    realSession(); let release;
    global.fetch = async url => url.endsWith('/auth/logout') ? noContent() : new Promise(resolve => { release = resolve; });
    const loading = authService.me().catch(e => e);
    for (let i = 0; i < 10 && !release; i++) await new Promise(resolve => setTimeout(resolve, 0));
    assert.ok(release);
    await authService.logout();
    release(json(patient));
    const result = await loading;
    assert.equal(result.code, 'SESSION_CHANGED');
    assert.equal(authSession.user(), null);
    assert.equal(demo.user(), undefined);
  });
  console.log(`\n${checks} comprobaciones P4 correctas.`);
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch;
  global.__DEV__ = oldDev;
  Module._resolveFilename = originalResolve;
  Module._extensions['.ts'] = originalTs;
});
