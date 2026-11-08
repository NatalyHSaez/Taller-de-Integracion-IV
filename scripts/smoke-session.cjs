/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
let tokens = null;
const storage = {
  saveTokens: async (accessToken, refreshToken) => { tokens = { accessToken, refreshToken }; },
  clearTokens: async () => { tokens = null; },
  getAccessToken: async () => tokens?.accessToken ?? null,
  getRefreshToken: async () => tokens?.refreshToken ?? null,
};
let refreshCalls = 0;
async function fakeFetch(url, options) {
  if (url.endsWith('/auth/refresh')) refreshCalls++;
  return fetch(url, options);
}
function load(filename) {
  let file = filename;
  if (!path.extname(file)) file = fs.existsSync(file + '.ts') ? file + '.ts' : path.join(file, 'index.ts');
  if (file === path.join(root, 'src/core/infrastructure/config/api-config.ts')) return { IS_API_CONFIGURED: true, API_V1_URL: 'http://localhost:8000/api/v1' };
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
  const { randomUUID } = require('node:crypto');
  const { authService } = load(path.join(root, 'src/modules/identity/application/authservice'));
  const { authSession } = load(path.join(root, 'src/core/application/session/auth-session'));
  const { apiClient } = load(path.join(root, 'src/core/infrastructure/http/api-client'));
  const { demo } = load(path.join(root, 'src/modules/demo/infrastructure/demo-store'));
  for (const role of ['PATIENT', 'CAREGIVER']) {
    const email = `ti462.${randomUUID()}@example.com`, password = `Test-${randomUUID()}`;
    const user = await authService.register({ fullName: 'Prueba Sesion', email, password, role,
      ...(role === 'PATIENT' ? { birthDate: '2000-01-01' } : {}) });
    try {
      await authService.login(email, password);
      authSession.clear(); demo.logout();
      await authService.restore();
      assert.equal(authSession.user().id, user.id);
      const oldRefresh = tokens.refreshToken;
      // Fuerza 401 real sin esperar a que expire el JWT.
      authSession.updateTokens({ ...authSession.tokens(), accessToken: 'expired-test-token' });
      await storage.saveTokens('expired-test-token', oldRefresh);
      const before = refreshCalls;
      const results = await Promise.all(Array.from({ length: 6 }, () => apiClient.get('/me')));
      assert.ok(results.every(result => result.id === user.id));
      assert.equal(refreshCalls - before, 1);
      assert.notEqual(tokens.refreshToken, oldRefresh);
      const rotated = tokens.refreshToken;
      await authService.logout();
      assert.equal(tokens, null);
      assert.equal(authSession.user(), null);
      const rejected = await fetch('http://localhost:8000/api/v1/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rotated }) });
      assert.equal(rejected.status, 401);
      console.log(`${role}: restauracion, seis 401 con un refresh, tokens rotados y logout revocado comprobados en Docker.`);
    } finally { await authService.logout(); }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
