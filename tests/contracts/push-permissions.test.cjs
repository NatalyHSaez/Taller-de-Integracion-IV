const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createExpoPushPermissions, PUSH_CHANNEL_ID } = projectRequire('src/modules/notifications/infrastructure/native/expo-push-permissions');
const { configurePushPermissions } = projectRequire('src/modules/notifications/application/ports/push-permission-port');
const { getPushPermission, requestPushPermission } = projectRequire('src/modules/notifications/application/use-cases/push-permissions');
const { canRequestPushPermission } = projectRequire('src/modules/notifications/domain/push-permission');
const ios = { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 };
function fake(platform, current, requested = current) {
  const calls = [];
  const sdk = {
    IosAuthorizationStatus: ios,
    AndroidImportance: { DEFAULT: 5 },
    AndroidNotificationVisibility: { PRIVATE: 2 },
    async getPermissionsAsync() { calls.push('get'); return current; },
    async requestPermissionsAsync(options) { calls.push(['request', options]); return requested; },
    async setNotificationChannelAsync(id, options) { calls.push(['channel', id, options]); },
  };
  return { calls, port: createExpoPushPermissions(async () => platform, async () => { calls.push('load'); return sdk; }) };
}
const undetermined = { status: 'undetermined', canAskAgain: true };
const granted = { status: 'granted', canAskAgain: true };
test('push: web y Expo Go no cargan el módulo ni solicitan permiso', async () => {
  for (const platform of ['web-or-other', 'expo-go']) {
    const { port, calls } = fake(platform, undetermined);
    assert.deepEqual(await port.get(), { status: 'unsupported', reason: platform, canAskAgain: false });
    assert.equal((await port.request()).status, 'unsupported');
    assert.deepEqual(calls, []);
  }
});
test('push: consultar Android no crea canal ni pide permiso', async () => {
  const { port, calls } = fake('android', undetermined);
  assert.deepEqual(await port.get(), undetermined);
  assert.deepEqual(calls, ['load', 'get']);
});
test('push: petición Android prepara canal privado antes del diálogo', async () => {
  const { port, calls } = fake('android', undetermined, granted);
  assert.deepEqual(await port.request(), granted);
  assert.deepEqual(calls.map(c => Array.isArray(c) ? c[0] : c), ['load','channel','get','request']);
  assert.equal(calls[1][1], PUSH_CHANNEL_ID);
  assert.equal(calls[1][2].lockscreenVisibility, 2);
  assert.equal(calls[1][2].importance, 5);
});
test('push: no repite diálogo si concedido o bloqueado', async () => {
  for (const state of [granted, { status: 'denied', canAskAgain: false }]) {
    const { port, calls } = fake('android', state);
    assert.deepEqual(await port.request(), state);
    assert.equal(canRequestPushPermission(state), false);
    assert.ok(!calls.some(c => Array.isArray(c) && c[0] === 'request'));
  }
});
test('push: iOS diferencia provisional, temporal, autorizado y denegado sin canal Android', async () => {
  for (const [status, expected] of [[0,'undetermined'],[1,'denied'],[2,'granted'],[3,'provisional'],[4,'ephemeral']]) {
    const { port, calls } = fake('ios', { status: 'denied', canAskAgain: true, ios: { status } });
    assert.equal((await port.get()).status, expected);
    assert.deepEqual(calls, ['load','get']);
  }
  const { port, calls } = fake('ios', undetermined, { status:'denied', canAskAgain: false });
  assert.equal((await port.request()).status, 'denied');
  assert.deepEqual(calls.map(c => Array.isArray(c) ? c[0] : c), ['load','get','request']);
});
test('push: aplicación comparte solicitud concurrente y permite reintentar tras error', async () => {
  let count = 0;
  configurePushPermissions({ get: async () => undetermined, request: async () => { count++; if (count === 1) throw new Error('fallo nativo'); return granted; } });
  assert.deepEqual(await getPushPermission(), undetermined);
  const first = requestPushPermission(), second = requestPushPermission();
  assert.equal(first, second);
  await assert.rejects(first, /fallo nativo/);
  assert.equal(count, 1);
  assert.deepEqual(await requestPushPermission(), granted);
  assert.equal(count, 2);
});
test('push: plugin y canal coherentes; la pantalla solo solicita a través de acción explícita', () => {
  const root = path.resolve(__dirname, '../..');
  const config = JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8'));
  const plugin = config.expo.plugins.find(p => Array.isArray(p) && p[0] === 'expo-notifications');
  assert.equal(plugin[1].defaultChannel, PUSH_CHANNEL_ID);
  assert.equal(plugin[1].enableBackgroundRemoteNotifications, false);
  const panel = fs.readFileSync(path.join(root,'src/modules/notifications/presentation/components/push-permission-panel.tsx'),'utf8');
  assert.match(panel, /onPress=\{\(\) => void run\(true\)\}/);
  assert.doesNotMatch(panel, /getExpoPushTokenAsync|\/devices|scheduleNotificationAsync/);
});
