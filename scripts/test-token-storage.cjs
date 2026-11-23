/* Pruebas del almacenamiento de tokens para Expo nativo y web. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

async function main() {
  for (const platform of ['android', 'web']) {
    const sessionData = new Map();
    const legacyData = new Map();
    let fail = false;
    const sessionStore = {
      setItem(key, value) {
        if (fail && key === 'auth_refresh_token') throw new Error('Storage failed');
        sessionData.set(key, value);
      },
      getItem: key => sessionData.get(key) ?? null,
      removeItem: key => { sessionData.delete(key); },
    };
    const localStore = {
      setItem: (key, value) => legacyData.set(key, value),
      getItem: key => legacyData.get(key) ?? null,
      removeItem: key => { legacyData.delete(key); },
    };
    const native = {
      setItemAsync: async (key, value) => {
        await new Promise(resolve => setTimeout(resolve, 2));
        sessionStore.setItem(key, value);
      },
      getItemAsync: async key => sessionStore.getItem(key),
      deleteItemAsync: async key => sessionStore.removeItem(key),
    };
    const exports = {};
    const source = fs.readFileSync(path.join(__dirname, '../src/core/infrastructure/storage/token-storage.ts'), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText, {
      exports,
      sessionStorage: sessionStore,
      localStorage: localStore,
      require: name => name === 'react-native' ? { Platform: { OS: platform } } : native,
    });

    legacyData.set('auth_access_token', 'legacy-access');
    legacyData.set('auth_refresh_token', 'legacy-refresh');
    if (platform === 'web') {
      assert.equal(await exports.getAccessToken(), null, 'No debe leer access token antiguo de localStorage');
      assert.equal(await exports.getRefreshToken(), null, 'No debe leer refresh token antiguo de localStorage');
      assert.equal(legacyData.size, 0, 'Debe limpiar tokens web antiguos');
    }

    await Promise.all([
      exports.saveTokens('old', 'old-refresh'),
      exports.clearTokens(),
      exports.saveTokens('new', 'new-refresh'),
    ]);
    assert.equal(await exports.getAccessToken(), 'new');
    assert.equal(await exports.getRefreshToken(), 'new-refresh');
    if (platform === 'web') assert.equal(legacyData.size, 0, 'No debe guardar nuevos tokens en localStorage');

    await Promise.all([exports.saveTokens('rotated', 'rotated-refresh'), exports.clearTokens()]);
    assert.equal(await exports.getAccessToken(), null);
    assert.equal(await exports.getRefreshToken(), null);

    fail = true;
    await assert.rejects(exports.saveTokens('partial', 'failure'));
    assert.equal(await exports.getAccessToken(), null, 'Un guardado parcial debe hacer rollback del access token');
    assert.equal(await exports.getRefreshToken(), null, 'Un guardado parcial debe hacer rollback del refresh token');
    fail = false;
    await exports.saveTokens('recovery', 'recovery-refresh');
    assert.equal(await exports.getRefreshToken(), 'recovery-refresh', 'La cola debe recuperarse después de un error');
    await exports.clearTokens();
  }
  console.log('Storage: android/web, sesiones ordenadas, rotación, cierre, rollback y limpieza de localStorage aprobados.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
