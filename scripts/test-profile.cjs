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
let savedName = 'Cuenta real';
let wrongIdentity = false;
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
  if (options.method === 'PATCH') savedName = JSON.parse(options.body).fullName;
  const body = route.endsWith('/login')
    ? { accessToken: 'access', refreshToken: 'refresh', tokenType: 'bearer', expiresIn: 3600 }
    : { id: wrongIdentity ? '87654321-1234-4123-8123-123456789abc' : id, fullName: savedName, email: 'real@example.com', roles: [role] };
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
  const { authService } = load(path.join(root, 'src/modules/identity/application/authservice'));
  const { authSession } = load(path.join(root, 'src/core/application/session/auth-session'));
  const { appState } = load(path.join(root, 'src/core/application/session/app-state'));
  const { buildProfileUpdate, updateMyProfile, profileErrorMessage } = load(path.join(root, 'src/modules/identity/application/profile'));
  for (const invalid of ['', '  ', 'ab', 'x'.repeat(201)]) assert.throws(() => buildProfileUpdate(invalid));
  assert.equal(buildProfileUpdate('  Ana  ').fullName, 'Ana');
  for (const userRole of ['PATIENT', 'CAREGIVER']) {
    role = userRole;
    await authService.login('real@example.com', 'Test1234');
    calls.length = 0;
    const updated = await updateMyProfile('  Nombre actualizado  ');
    assert.equal(updated.fullName, 'Nombre actualizado');
    assert.equal(authSession.user().fullName, 'Nombre actualizado');
    assert.equal(appState.snapshot().user.name, 'Nombre actualizado');
    const patch = calls.find(c => c.options.method === 'PATCH');
    assert.equal(patch.route, '/api/v1/me');
    assert.equal(patch.options.headers.get('Authorization'), 'Bearer access');
    assert.deepEqual(JSON.parse(patch.options.body), { fullName: 'Nombre actualizado' });
    assert.equal(calls.length, 1);
    assert.equal((await authService.me()).fullName, 'Nombre actualizado');
    const before = authSession.user();
    failure = { path: '/api/v1/me', status: 422 };
    await assert.rejects(updateMyProfile('Otro nombre'));
    assert.equal(authSession.user(), before);
    assert.equal(appState.snapshot().user.name, before.fullName);
    failure = { path: '/api/v1/me', status: 500 };
    calls.length = 0;
    await assert.rejects(updateMyProfile('Otro nombre'));
    assert.equal(calls.length, 1, 'No reintentar PATCH ante 500');
    failure = null;
    wrongIdentity = true;
    await assert.rejects(updateMyProfile('Otro nombre'));
    assert.equal(authSession.user(), before);
    wrongIdentity = false;
    await authService.logout();
    await assert.rejects(updateMyProfile('Sin sesión'));
  }
  const { ApiError } = load(path.join(root, 'src/core/infrastructure/http/errors'));
  assert.match(profileErrorMessage(new ApiError({ code: 'VALIDATION_ERROR', status: 422, message: 'Error' })), /rechazó el nombre/);
  console.log('Perfil aprobado: validación, PATCH autenticado, solo fullName, ambos roles, sincronización, persistencia simulada y errores sin modificar identidad local.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
