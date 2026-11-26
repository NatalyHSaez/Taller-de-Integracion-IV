const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createExpoPushNavigation}=projectRequire('src/modules/notifications/infrastructure/native/expo-push-navigation');
const {configurePushNavigation}=projectRequire('src/modules/notifications/application/ports/push-navigation-port');
const {startPushNavigation}=projectRequire('src/modules/notifications/application/use-cases/push-navigation');
const {authSession}=projectRequire('src/core/application/session/auth-session');
const {appState,configureAppState}=projectRequire('src/core/application/session/app-state');
const tick=()=>new Promise(r=>setImmediate(r));
const tokens={accessToken:'test-only',refreshToken:'test-only',tokenType:'bearer',expiresIn:60};
function login(id='a',roles=['PATIENT']){authSession.startBackend(tokens,{id,fullName:'Test',email:'test@example.com',roles});}
function reset(t){authSession.clear();t.after(()=>authSession.clear());}
function response(id='native-a',action='default'){
  return {actionIdentifier:action,notification:{request:{identifier:id,get content(){throw Error('no leer payload');}}}};
}
function sdk(initial=null){let last=initial,listener,removed=0,cleared=0;return {
  module:{DEFAULT_ACTION_IDENTIFIER:'default',getLastNotificationResponse:()=>last,clearLastNotificationResponse(){last=null;cleared++;},addNotificationResponseReceivedListener(fn){listener=fn;return {remove(){removed++;}};}},
  emit(value){last=value;listener(value);}, replay(value){listener(value);},removed:()=>removed,cleared:()=>cleared,last:()=>last,
};}
function source(){let cb,removed=0;configurePushNavigation({async subscribe(fn){cb=fn;return ()=>{removed++;};}});return {emit(origin){cb(origin);},removed:()=>removed};}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}

test('navegación push: web y Expo Go no cargan SDK',async()=>{
  for(const env of ['web-or-other','expo-go']){let loaded=0;const port=createExpoPushNavigation(async()=>env,async()=>{loaded++;throw Error('no SDK');});assert.equal(await port.subscribe(()=>assert.fail()),null);assert.equal(loaded,0);}
});
test('navegación push: consume respuesta inicial y deduplica entrega en vivo sin leer contenido',async()=>{
  const n=sdk(response());const events=[];const port=createExpoPushNavigation(async()=>'android',async()=>n.module);
  const stop=await port.subscribe((...args)=>events.push(args));assert.deepEqual(events,[['initial']]);assert.equal(n.last(),null);
  n.emit(response());assert.deepEqual(events,[['initial']]);assert.equal(n.cleared(),2);
  n.emit(response('native-b'));assert.deepEqual(events,[['initial'],['live']]);stop();stop();n.replay(response('native-c'));assert.equal(n.removed(),1);assert.equal(events.length,2);
});
test('navegación push: acción personalizada e identificador inválido no abren rutas',async()=>{
  const n=sdk(response('native-a','custom'));const events=[];const port=createExpoPushNavigation(async()=>'ios',async()=>n.module);
  const stop=await port.subscribe(origin=>events.push(origin));assert.equal(n.last(),null);
  n.emit(response('','default'));n.emit(response('native-b','reply'));assert.deepEqual(events,[]);stop();
});
test('navegación push: no elimina otra respuesta pendiente por un callback antiguo',async()=>{
  const n=sdk();const events=[];const port=createExpoPushNavigation(async()=>'android',async()=>n.module);const stop=await port.subscribe(x=>events.push(x));
  // El SDK puede conservar una respuesta diferente de la que entrega al listener.
  const newer=response('newer');n.module.getLastNotificationResponse=()=>newer;n.replay(response('older'));
  assert.equal(n.cleared(),0);assert.deepEqual(events,['live']);stop();
});
test('navegación push: fallo al consumir respuesta no provoca navegación',async()=>{
  const n=sdk(response());n.module.clearLastNotificationResponse=()=>{throw Error('native');};const events=[];
  const stop=await createExpoPushNavigation(async()=>'ios',async()=>n.module).subscribe(x=>events.push(x));assert.deepEqual(events,[]);stop();
});
test('navegación push: sin sesión no abre ni retiene pulsación para login posterior',async t=>{
  reset(t);const n=source();let opens=0;const stop=startPushNavigation(()=>opens++);t.after(stop);await tick();n.emit('initial');n.emit('live');login();await tick();assert.equal(opens,0);n.emit('live');assert.equal(opens,1);
});
test('navegación push: paciente restaurado puede abrir listado inicial y en vivo; refresh conserva sesión',async t=>{
  reset(t);login();const n=source();let opens=0;const stop=startPushNavigation(()=>opens++);t.after(stop);await tick();n.emit('initial');authSession.updateTokens({...tokens,accessToken:'rotated'});n.emit('live');assert.equal(opens,2);
});
test('navegación push: respuesta inicial tardía de otra sesión no abre listado',async t=>{
  reset(t);login();const n=source();let opens=0;const stop=startPushNavigation(()=>opens++);t.after(stop);await tick();authSession.clear();login('b');n.emit('initial');assert.equal(opens,0);n.emit('live');assert.equal(opens,1);authSession.clear();n.emit('live');assert.equal(opens,1);
});
test('navegación push: cuidador requiere selección previa y nunca cambia el paciente',async t=>{
  reset(t);login('caregiver',['CAREGIVER']);configureAppState({async listLinkedPatients(){return [{relationshipType:'CAREGIVER',patientId:'p1',fullName:'Paciente uno',relationshipId:'r1',permissions:[]},{relationshipType:'CAREGIVER',patientId:'p2',fullName:'Paciente dos',relationshipId:'r2',permissions:[]}];},clearClinicalCache(){}});
  await appState.loadRealPatients();const n=source();let opens=0;const stop=startPushNavigation(()=>opens++);t.after(stop);await tick();n.emit('live');assert.equal(opens,0);assert.equal(appState.snapshot().selectedPatient,null);appState.selectPatient('p2');n.emit('live');assert.equal(opens,1);assert.equal(appState.snapshot().selectedPatient.id,'p2');login('doctor',['DOCTOR']);n.emit('live');assert.equal(opens,1);
});
test('navegación push: desmontaje descarta callbacks e instalación tardía',async t=>{
  reset(t);login();const wait=deferred();let callback,removed=0,opens=0;configurePushNavigation({async subscribe(fn){callback=fn;await wait.promise;return ()=>removed++;}});
  const stop=startPushNavigation(()=>opens++);await tick();stop();stop();callback('live');wait.resolve();await tick();assert.equal(removed,1);assert.equal(opens,0);
});
test('navegación push: sin adaptador o con fallo nativo no navega',async t=>{
  reset(t);login();let opens=0;configurePushNavigation(undefined);const a=startPushNavigation(()=>opens++);await tick();a();configurePushNavigation({async subscribe(){throw Error('native');}});const b=startPushNavigation(()=>opens++);await tick();b();assert.equal(opens,0);
});
test('navegación push: raíz espera navegador y usa solo ruta fija, composición conecta SDK real',()=>{
  const root=path.resolve(__dirname,'../..');const layout=fs.readFileSync(path.join(root,'app/_layout.tsx'),'utf8');const composition=fs.readFileSync(path.join(root,'composition/configure/configure-notifications.ts'),'utf8');
  assert.match(layout,/useRootNavigationState\(\)\?\.key/);assert.match(layout,/if \(loading \|\| !rootKey\) return;/);assert.match(layout,/startPushNavigation\(\(\) => router\.navigate\("\/notificaciones"\)\)/);assert.match(composition,/configurePushNavigation\(expoPushNavigation\)/);assert.ok(fs.existsSync(path.join(root,'app/notificaciones.tsx')));
});
