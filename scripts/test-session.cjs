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
const calls = [];
const id = '12345678-1234-4123-8123-123456789abc';
const storage = {
  saveTokens: async (accessToken, refreshToken) => { tokens = { accessToken, refreshToken }; },
  clearTokens: async () => { tokens = null; },
  getAccessToken: async () => tokens?.accessToken ?? null,
  getRefreshToken: async () => tokens?.refreshToken ?? null,
};
let refreshCalls = 0;
let currentAccess = 'access';
let rejectRefresh = false;
let offline = false;
let holdRefresh = null;
async function fakeFetch(url, options) {
  const route = new URL(url).pathname;
  calls.push({ route, options });
  if (offline) throw new TypeError('Network unavailable');
  if (route.endsWith('/logout')) return new Response(null, { status: 204 });
  if (route.endsWith('/refresh')) {
    refreshCalls++;
    if (holdRefresh) await holdRefresh;
    if (rejectRefresh) return new Response('{}', { status: 401 });
    currentAccess = `renewed-${refreshCalls}`;
    return Response.json({ accessToken: currentAccess, refreshToken: `refresh-${refreshCalls}`, tokenType: 'bearer', expiresIn: 900 });
  }
  if (route.endsWith('/login')) {
    currentAccess = 'access';
    return Response.json({ accessToken: currentAccess, refreshToken: 'refresh', tokenType: 'bearer', expiresIn: 900 });
  }
  if (options.headers.get('Authorization') !== `Bearer ${currentAccess}`) return new Response('{}', { status: 401 });
  return Response.json({ id, fullName: 'Cuenta real', email: 'real@example.com', roles: [role] });
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
  const { apiClient } = load(path.join(root, 'src/core/infrastructure/http/api-client'));
  const { appState } = load(path.join(root, 'src/core/application/session/app-state'));
  const { demo } = load(path.join(root, 'src/modules/demo/infrastructure/demo-store'));
  for (const userRole of ['PATIENT', 'CAREGIVER']) {
    role = userRole;
    await authService.login('real@example.com', 'Test1234');
    authSession.clear(); demo.logout(); // Simula reiniciar memoria conservando almacenamiento.
    await Promise.all([authService.restore(), authService.restore()]);
    assert.equal(authSession.user().id, id);
    assert.equal(appState.snapshot().isAuthenticated, true);
    assert.equal(appState.snapshot().selectedPatient?.id ?? null, role === 'PATIENT' ? id : null);
    currentAccess = 'expired';
    const before = refreshCalls;
    await Promise.all(Array.from({ length: 8 }, () => apiClient.get('/me')));
    assert.equal(refreshCalls - before, 1, 'Ocho 401 deben compartir un refresh');
    assert.equal(authSession.accessToken(), tokens.accessToken);
    assert.equal(authSession.refreshToken(), tokens.refreshToken);
    assert.equal(authSession.user().id, id, 'Refresh conserva identidad');
    const rotated = tokens.refreshToken;
    await authService.logout();
    assert.equal(tokens, null);
    assert.equal(appState.snapshot().isAuthenticated, false);
    assert.ok(calls.some(c => c.route.endsWith('/logout') && JSON.parse(c.options.body).refreshToken === rotated));
  }
  await authService.login('real@example.com', 'Test1234');
  currentAccess = 'expired'; rejectRefresh = true;
  await assert.rejects(apiClient.get('/me'));
  assert.equal(tokens, null);
  assert.equal(authSession.user(), null);
  rejectRefresh = false;
  await authService.login('real@example.com', 'Test1234');
  authSession.clear(); demo.logout(); offline = true;
  await assert.rejects(authService.restore());
  assert.ok(tokens, 'Fallo de red no borra credenciales');
  assert.equal(authSession.user(), null);
  offline = false;
  await authService.restore();
  assert.equal(authSession.user().id, id);
  // Logout durante refresh: ni la respuesta ni sus tokens pueden reabrir la sesion.
  let release;
  holdRefresh = new Promise(resolve => { release = resolve; });
  currentAccess = 'expired';
  const refreshing = apiClient.get('/me').catch(() => null);
  while (!calls.at(-1).route.endsWith('/refresh')) await new Promise(resolve => setTimeout(resolve, 1));
  await authService.logout();
  release(); await refreshing; holdRefresh = null;
  assert.equal(tokens, null);
  assert.equal(authSession.user(), null);
  assert.equal(appState.snapshot().isAuthenticated, false);
  // El logout sin red tambien limpia estado y tokens.
  await authService.login('real@example.com', 'Test1234');
  offline = true;
  await authService.logout(); offline = false;
  assert.equal(tokens, null);
  assert.equal(authSession.mode(), null);
  console.log('Sesion: restauracion ambos roles, refresh concurrente unico, rotacion, rechazo, red temporal, logout offline y respuesta tardia aprobados.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
