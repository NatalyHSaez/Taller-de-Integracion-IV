const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createExpoPushToken, resolvePushProjectId } = projectRequire('src/modules/notifications/infrastructure/native/expo-push-token');
const { isExpoPushToken } = projectRequire('src/modules/notifications/domain/push-token');
const { configurePushToken } = projectRequire('src/modules/notifications/application/ports/push-token-port');
const { configurePushPermissions } = projectRequire('src/modules/notifications/application/ports/push-permission-port');
const { obtainPushToken, preparePushToken } = projectRequire('src/modules/notifications/application/use-cases/push-token');
const { authSession } = projectRequire('src/core/application/session/auth-session');
const projectId = '12345678-1234-4234-8234-123456789abc';
const token = 'ExponentPushToken[test_token-123]';
const ready = { status: 'ready', token, projectId, platform: 'android' };
const granted = { status: 'granted', canAskAgain: true };
const denied = { status: 'denied', canAskAgain: false };
function native(platform, id = projectId, response = {type:'expo', data:token}) {
  const calls = [];
  const sdk = {
    AndroidImportance: { DEFAULT: 3 }, AndroidNotificationVisibility: { PRIVATE: 0 },
    async setNotificationChannelAsync(channel, options) { calls.push(['channel', channel, options]); },
    async getExpoPushTokenAsync(options) { calls.push(['token', options]); return response; },
  };
  const port = createExpoPushToken(async () => platform, async () => { calls.push(['project']); return id; }, async () => { calls.push(['load']); return sdk; });
  return { port, calls };
}
function start(id = 'test-user') {
  authSession.startBackend({accessToken:'test-access', refreshToken:'test-refresh', tokenType:'bearer', expiresIn:60}, {id,fullName:'Test',email:'test@example.com',roles:['PATIENT']});
}
function permissions(get = async () => granted) {
  configurePushPermissions({ get, request: async () => { throw new Error('No debe solicitar permiso'); } });
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; }
test('token push: exige UUID real configurado y rechaza configuraciones contradictorias', () => {
  assert.equal(resolvePushProjectId(projectId, null), projectId);
  assert.equal(resolvePushProjectId(null, projectId), projectId);
  assert.equal(resolvePushProjectId(projectId, projectId.toUpperCase()), projectId);
  for (const [a,b] of [[null,null],['placeholder',null],[projectId,'invalid'],[projectId,'12345678-1234-4234-8234-123456789abd'],['00000000-0000-0000-0000-000000000000',null]]) assert.equal(resolvePushProjectId(a,b),null);
});
test('token push: no carga SDK en web, Expo Go o sin projectId', async () => {
  for (const platform of ['web-or-other','expo-go']) {
    const {port,calls}=native(platform);
    assert.equal((await port.obtain()).status,'unsupported'); assert.deepEqual(calls,[]);
  }
  const {port,calls}=native('android',null);
  assert.equal((await port.obtain()).status,'project-not-configured'); assert.deepEqual(calls,[['project']]);
});
test('token push: Android prepara canal privado y pide token Expo con projectId', async () => {
  const {port,calls}=native('android');
  assert.deepEqual(await port.obtain(),ready);
  assert.deepEqual(calls.map(c=>c[0]),['project','load','channel','token']);
  assert.equal(calls[2][1],'health-updates'); assert.equal(calls[2][2].lockscreenVisibility,0);
  assert.deepEqual(calls[3][1],{projectId});
});
test('token push: iOS no crea canal Android y rechaza tokens ajenos a Expo', async () => {
  const {port,calls}=native('ios',projectId,{type:'expo',data:'ExpoPushToken[test_2]'});
  assert.equal((await port.obtain()).platform,'ios'); assert.deepEqual(calls.map(c=>c[0]),['project','load','token']);
  for (const bad of ['','token-fcm','ExpoPushToken[]','ExpoPushToken[abc\n]']) assert.equal(isExpoPushToken(bad),false);
  for (const response of [{type:'fcm',data:token},{type:'expo',data:'not-token'}]) assert.equal((await native('ios',projectId,response).port.obtain()).status,'unavailable');
});
test('token push: sin sesión, permiso denegado o plataforma no compatible no obtiene token', async () => {
  let calls=0; configurePushToken({obtain:async()=>{calls++;return ready;}});
  authSession.clear(); permissions(); assert.equal((await obtainPushToken()).status,'session-changed');
  start(); permissions(async()=>denied); assert.equal((await obtainPushToken()).status,'permission-required');
  permissions(async()=>({status:'unsupported',reason:'expo-go',canAskAgain:false})); assert.equal((await obtainPushToken()).status,'unsupported');
  assert.equal(calls,0);
});
test('token push: comparte solicitudes simultáneas y consulta nuevamente sin persistir', async () => {
  start(); permissions(); let calls=0; configurePushToken({obtain:async()=>{calls++;return ready;}});
  const a=obtainPushToken(), b=obtainPushToken(); assert.equal(a,b);
  assert.deepEqual(await a,ready); assert.equal(calls,1);
  assert.equal(await preparePushToken(),'ready'); assert.equal(calls,2);
});
test('token push: una respuesta tardía de otra sesión se descarta sin afectar la nueva', async () => {
  start('a'); permissions(); const old=deferred(); const entered=deferred(); let calls=0;
  configurePushToken({obtain:()=>{calls++; if(calls===1){entered.resolve();return old.promise;}return Promise.resolve(ready);}});
  const a=obtainPushToken(); await entered.promise;
  authSession.clear(); start('b'); const b=obtainPushToken();
  old.resolve(ready); assert.equal((await a).status,'session-changed'); assert.deepEqual(await b,ready);
});
test('token push: revocación durante la solicitud descarta el resultado', async () => {
  start(); let reads=0; permissions(async()=>++reads===1?granted:denied);
  configurePushToken({obtain:async()=>ready}); assert.equal((await obtainPushToken()).status,'permission-required');
});
test('token push: error del proveedor no revela token ni impide reintentar', async () => {
  start(); permissions(); let calls=0; configurePushToken({obtain:async()=>{if(++calls===1)throw new Error(token);return ready;}});
  assert.deepEqual(await obtainPushToken(),{status:'unavailable'}); assert.equal(await preparePushToken(),'ready');
});
