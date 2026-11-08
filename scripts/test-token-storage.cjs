/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
async function main() {
  for (const platform of ['android', 'web']) {
    const data = new Map();
    let fail = false;
    const store = {
      setItem(key, value) { if (fail && key === 'auth_refresh_token') throw new Error('Storage failed'); data.set(key, value); },
      getItem: key => data.get(key) ?? null,
      removeItem: key => { data.delete(key); },
    };
    const native = {
      setItemAsync: async (key, value) => { await new Promise(resolve => setTimeout(resolve, 2)); store.setItem(key, value); },
      getItemAsync: async key => store.getItem(key),
      deleteItemAsync: async key => store.removeItem(key),
    };
    const exports = {};
    const source = fs.readFileSync(path.join(__dirname, '../src/core/infrastructure/storage/token-storage.ts'), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
      exports, localStorage: store,
      require: name => name === 'react-native' ? { Platform: { OS: platform } } : native,
    });
    await Promise.all([exports.saveTokens('old', 'old-refresh'), exports.clearTokens(), exports.saveTokens('new', 'new-refresh')]);
    assert.equal(await exports.getAccessToken(), 'new');
    assert.equal(await exports.getRefreshToken(), 'new-refresh');
    await Promise.all([exports.saveTokens('rotated', 'rotated-refresh'), exports.clearTokens()]);
    assert.equal(await exports.getAccessToken(), null);
    assert.equal(await exports.getRefreshToken(), null);
    fail = true;
    await assert.rejects(exports.saveTokens('partial', 'failure'));
    assert.equal(await exports.getAccessToken(), null);
    assert.equal(await exports.getRefreshToken(), null);
  }
  console.log('Storage: escrituras ordenadas, logout concurrente y limpieza de escritura parcial aprobados en adaptadores web/native.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
