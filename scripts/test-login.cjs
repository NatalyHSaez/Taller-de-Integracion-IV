/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
let tokens = null;
let role = 'PATIENT';
let failure = null;
let userId = '12345678-1234-4123-8123-123456789abc';
let badTokens = false;
const calls = [];
const id = '12345678-1234-4123-8123-123456789abc';
const storage = {
  saveTokens: async (accessToken, refreshToken) => { tokens = { accessToken, refreshToken }; },
  clearTokens: async () => { tokens = null; },
  getAccessToken: async () => tokens?.accessToken ?? null,
  getRefreshToken: async () => tokens?.refreshToken ?? null,
};
async function fakeFetch(url, options) {
  const route = new URL(url).pathname;
  calls.push({ route, options });
  if (failure?.path === route) return new Response(JSON.stringify({ detail: 'Error de prueba' }), { status: failure.status, headers: { 'content-type': 'application/json' } });
  if (route.endsWith('/logout')) return new Response(null, { status: 204 });
  const body = route.endsWith('/login')
    ? { accessToken: 'access', refreshToken: 'refresh', tokenType: 'bearer', expiresIn: badTokens ? 0 : 3600 }
    : { id: userId, fullName: 'Cuenta real', email: 'real@example.com', roles: [role], doctorStatus: role === 'DOCTOR' ? 'PENDING' : null };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}
function load(filename) {
  let file = filename;
  if (!path.extname(file)) file = fs.existsSync(file + '.ts') ? file + '.ts' : path.join(file, 'index.ts');
  if (file === path.join(root, 'src/core/infrastructure/config/api-config.ts')) return { IS_API_CONFIGURED: true, API_V1_URL: 'http://test.local/api/v1' };
  if (file === path.join(root, 'src/core/infrastructure/storage/token-storage.ts')) return storage;
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const source = fs.readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    exports, require: name => load(name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name)),
    Error, Date, Headers, Response, AbortController, AbortSignal, setTimeout, clearTimeout, console,
    __DEV__: false, fetch: fakeFetch,
  }, { filename: file });
  return exports;
}
async function main() {
  load(path.join(root, 'composition/configure/configure-identity'));
  load(path.join(root, 'composition/configure/configure-app-state'));
  const { authService } = load(path.join(root, 'src/modules/identity/application/use-cases/auth-service'));
  const { authSession } = load(path.join(root, 'src/core/application/session/auth-session'));
  const { appState } = load(path.join(root, 'src/core/application/session/app-state'));
  for (const userRole of ['PATIENT', 'CAREGIVER', 'DOCTOR']) {
    role = userRole;
    calls.length = 0;
    // Un correo también presente en mocks debe ir al backend por defecto.
    await authService.login('paciente@ejemplo.com', 'Paciente123');
    assert.equal(calls.filter(c => c.route.endsWith('/login')).length, 1);
    assert.equal(calls.filter(c => c.route.endsWith('/me')).length, 1);
    assert.equal(authSession.mode(), 'backend');
    assert.equal(appState.snapshot().user.id, id);
    assert.equal(appState.snapshot().user.role, userRole.toLowerCase());
    assert.equal(appState.snapshot().selectedPatient?.id ?? null, role === 'PATIENT' ? id : null);
    if (role === 'CAREGIVER') assert.equal(appState.snapshot().patients.length, 0);
    assert.equal(tokens.accessToken, 'access');
    await authService.logout();
  }
  for (const scenario of [{ path: '/api/v1/auth/login', status: 401 }, { path: '/api/v1/auth/login', status: 403 }, { path: '/api/v1/me', status: 403 }]) {
    failure = scenario;
    await assert.rejects(authService.login('real@example.com', 'Wrong123'));
    assert.equal(tokens, null);
    assert.equal(authSession.user(), null);
    assert.equal(appState.snapshot().isAuthenticated, false);
  }
  failure = null;
  for (const unsupported of ['ADMIN', 'paciente']) {
    role = unsupported;
    await assert.rejects(authService.login('real@example.com', 'Test1234'));
    assert.equal(authSession.mode(), null);
    assert.equal(tokens, null);
  }
  role = 'PATIENT';
  badTokens = true;
  await assert.rejects(authService.login('real@example.com', 'Test1234'), e => e.code === 'INVALID_API_RESPONSE');
  assert.equal(tokens, null);
  assert.equal(authSession.mode(), null);
  badTokens = false;
  calls.length = 0;
  await authService.login('paciente@ejemplo.com', 'Paciente123');
  assert.equal(authSession.mode(), 'backend');
  assert.equal(calls.filter(c => c.route.endsWith('/login')).length, 1);
  userId = '00000000-0000-4000-8000-00000000b002';
  await assert.rejects(authService.me(), e => e.code === 'INVALID_API_RESPONSE');
  assert.equal(authSession.user().id, id, 'GET /me no sustituye al usuario de la sesión');
  userId = id;
  await authService.logout();
  assert.equal(authSession.mode(), null);
  assert.equal(tokens, null);
  console.log('Login aprobado: PATIENT/CAREGIVER/DOCTOR, UUID real, /me único, errores sin sesión residual y sin modo demo.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
