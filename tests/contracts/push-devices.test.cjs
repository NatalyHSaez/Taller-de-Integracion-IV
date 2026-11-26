const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerPushDevice, unregisterPushDevice } = projectRequire('src/modules/notifications/application/use-cases/push-devices');
const { configurePushDevices } = projectRequire('src/modules/notifications/application/ports/push-device-port');
const { configurePushToken } = projectRequire('src/modules/notifications/application/ports/push-token-port');
const { configurePushPermissions } = projectRequire('src/modules/notifications/application/ports/push-permission-port');
const { authSession } = projectRequire('src/core/application/session/auth-session');
const token = 'ExpoPushToken[test_only]';
const projectId = '12345678-1234-4234-8234-123456789abc';
const deviceId = 'device-test-1';
const ready = {status:'ready',token,projectId,platform:'android'};
const registered = {status:'registered',deviceId};
const unregistered = {status:'unregistered',deviceId};
function start(id='test-user') {
  authSession.startBackend({accessToken:'test-access',refreshToken:'test-refresh',tokenType:'bearer',expiresIn:60},{id,fullName:'Test',email:'test@example.com',roles:['PATIENT']});
}
function permission(status='granted') {
  configurePushPermissions({get:async()=>({status,canAskAgain:false}),request:async()=>{throw new Error('No debe abrir diálogo');}});
}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function setup(overrides={}, obtain=async()=>ready) {
  start();permission();configurePushToken({obtain});
  const calls=[];
  configurePushDevices({register:async(input,scope)=>{calls.push(['register',input,scope]);return registered;},unregister:async(id,scope)=>{calls.push(['unregister',id,scope]);return unregistered;},...overrides});
  return calls;
}
test('dispositivos push: sin adaptador real no obtiene token ni declara registro',async()=>{
  start();permission();let count=0;configurePushToken({obtain:async()=>{count++;return ready;}});
  assert.deepEqual(await registerPushDevice(),{status:'backend-not-configured'});
  assert.deepEqual(await unregisterPushDevice(),{status:'backend-not-configured'});assert.equal(count,0);
});
test('dispositivos push: exige sesión y permiso antes de registro',async()=>{
  const calls=setup();authSession.clear();assert.equal((await registerPushDevice()).status,'session-changed');
  start();permission('denied');assert.equal((await registerPushDevice()).status,'permission-required');assert.equal(calls.length,0);
});
test('dispositivos push: solo pasa token real del puerto y retorna confirmación sin identificadores',async()=>{
  const calls=setup();assert.deepEqual(await registerPushDevice(),{status:'registered'});
  assert.deepEqual(calls[0][1],{token,projectId,platform:'android'});assert.equal(calls[0][2].ownerId,'test-user');assert.equal(calls[0][2].signal.aborted,false);
  assert.deepEqual(await unregisterPushDevice(),{status:'unregistered'});assert.equal(calls[1][1],deviceId);
});
test('dispositivos push: sin confirmación o tras respuesta inválida no inventa registro',async()=>{
  for(const result of [null,{}, {status:'registered',deviceId:token},{status:'pending',deviceId}]){
    setup({register:async()=>result});assert.equal((await registerPushDevice()).status,'unconfirmed');assert.equal((await unregisterPushDevice()).status,'not-confirmed');
  }
});
test('dispositivos push: comparte registros simultáneos y bloquea operaciones opuestas',async()=>{
  const wait=deferred(), entered=deferred();let count=0;
  setup({register:async()=>{count++;entered.resolve();return wait.promise;}});
  const a=registerPushDevice(),b=registerPushDevice();assert.equal(a,b);await entered.promise;
  assert.equal((await unregisterPushDevice()).status,'busy');wait.resolve(registered);assert.equal((await a).status,'registered');assert.equal(count,1);
});
test('dispositivos push: sesión cambia durante token y no se llama al servidor',async()=>{
  const wait=deferred(),entered=deferred();const calls=setup({},()=>{entered.resolve();return wait.promise;});
  const a=registerPushDevice();await entered.promise;authSession.clear();start('new');wait.resolve(ready);
  assert.equal((await a).status,'session-changed');assert.equal(calls.length,0);
});
test('dispositivos push: cambio de sesión durante registro aborta y descarta confirmación',async()=>{
  const wait=deferred(),entered=deferred();let signal;
  setup({register:async(_,scope)=>{signal=scope.signal;entered.resolve();return wait.promise;}});
  const a=registerPushDevice();await entered.promise;authSession.clear();start('new');assert.equal(signal.aborted,true);
  assert.equal((await registerPushDevice()).status,'busy');wait.resolve(registered);assert.equal((await a).status,'session-changed');assert.equal((await unregisterPushDevice()).status,'not-confirmed');
});
test('dispositivos push: desvinculación funciona sin permiso y exige confirmación del mismo dispositivo',async()=>{
  let count=0;setup({unregister:async()=>++count===1?{status:'unregistered',deviceId:'other'}:unregistered});
  await registerPushDevice();permission('denied');assert.equal((await unregisterPushDevice()).status,'unconfirmed');
  assert.equal((await unregisterPushDevice()).status,'unregistered');assert.equal((await unregisterPushDevice()).status,'not-confirmed');
});
test('dispositivos push: logout o nueva sesión de misma cuenta descarta confirmación local',async()=>{
  const calls=setup();await registerPushDevice();authSession.clear();start();assert.equal((await unregisterPushDevice()).status,'not-confirmed');assert.equal(calls.length,1);
});
test('dispositivos push: fallo de transporte no expone token y permite reintentar',async()=>{
  let count=0;setup({register:async()=>{if(++count===1)throw new Error(token);return registered;}});
  assert.deepEqual(await registerPushDevice(),{status:'unconfirmed'});assert.deepEqual(await registerPushDevice(),{status:'registered'});
});
test('dispositivos push: cambio de sesión durante desvinculación descarta resultado',async()=>{
  const wait=deferred(),entered=deferred();let signal;setup({unregister:async(_,scope)=>{signal=scope.signal;entered.resolve();return wait.promise;}});
  await registerPushDevice();const a=unregisterPushDevice();await entered.promise;authSession.clear();start('next');assert.equal(signal.aborted,true);wait.resolve(unregistered);
  assert.equal((await a).status,'session-changed');assert.equal((await unregisterPushDevice()).status,'not-confirmed');
});
test('dispositivos push: nueva obtención utiliza token actualizado y refresh conserva la sesión',async()=>{
  let count=0;const calls=setup({},async()=>({...ready,token:++count===1?token:'ExpoPushToken[rotated_test_only]'}));
  assert.equal((await registerPushDevice()).status,'registered');
  authSession.updateTokens({accessToken:'new-access',refreshToken:'new-refresh',tokenType:'bearer',expiresIn:60});
  assert.equal((await registerPushDevice()).status,'registered');assert.equal(calls[1][1].token,'ExpoPushToken[rotated_test_only]');
  assert.equal((await unregisterPushDevice()).status,'unregistered');assert.equal(calls.length,3);
});
test('dispositivos push: producción no configura el puerto ni ejecuta las operaciones automáticamente',()=>{
  const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'../..');
  const forbidden=/\b(?:configurePushDevices|registerPushDevice|unregisterPushDevice)\b/;
  const allowed=new Set(['src/modules/notifications/application/ports/push-device-port.ts','src/modules/notifications/application/use-cases/push-devices.ts']);
  function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
    const file=`${dir}/${e.name}`;if(e.isDirectory())walk(file);
    else if(/\.tsx?$/.test(file)&&!allowed.has(file))assert.equal(forbidden.test(fs.readFileSync(path.join(root,file),'utf8')),false,file);
  }}
  for(const dir of ['src','app','composition'])walk(dir);
});
