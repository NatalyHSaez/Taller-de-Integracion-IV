// P6: pruebas sin Docker ni Expo Go. Ejecutar: node scripts/test-p6.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const oldResolve = Module._resolveFilename;
const oldTs = Module._extensions['.ts'];
const oldFetch = global.fetch;
const oldDev = global.__DEV__;
Module._resolveFilename = function(request, parent, ...rest) {
  return oldResolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...rest);
};
Module._extensions['.ts'] = (mod, file) => {
  if (file === path.join(root, 'config/api.ts')) {
    mod.exports = { IS_API_CONFIGURED: true, API_V1_URL: 'http://p6.test/api/v1' };
    return;
  }
  if (file === path.join(root, 'services/token-storage.ts')) {
    mod.exports = { getAccessToken: async () => null, getRefreshToken: async () => null,
      saveTokens: async () => {}, clearTokens: async () => {} };
    return;
  }
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  mod._compile(out.outputText, file);
};
global.__DEV__ = false;
const { authSession } = require('../services/auth-session');
const { demo } = require('../services/demo-store');
const { dataClient } = require('../services/data');
const { getDemoAlerts, getAlerts } = require('../services/alerts');
const { readingsService } = require('../services/readings');
const { getNotifications, markNotificationRead } = require('../services/notifications');
const { mockApi } = require('../services/mocks/api-mock');
const { readingsToMeasurements } = require('../services/mocks/measurement-mapper');
const { MOCK_READINGS } = require('../services/mocks/api-data');
const one = '11111111-1111-4111-8111-111111111111';
const two = '22222222-2222-4222-8222-222222222222';
const token = { accessToken: 'p6-t', refreshToken: 'p6-r', tokenType: 'bearer', expiresIn: 900 };
const user = id => ({ id, fullName: 'Paciente', email: id+'@example.org', roles: ['PATIENT'] });
const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers:{'Content-Type':'application/json'} });
const issue = (status, errorCode) => json({detail:'Error de prueba', errorCode}, status);
const tick = () => new Promise(resolve => setImmediate(resolve));
let total = 0;
async function check(label, action) {
  authSession.clear(); demo.logout(); dataClient.clearCache();
  global.fetch = async url => { throw new Error('Solicitud inesperada: '+url); };
  try { await action(); total++; console.log('OK', label); }
  catch (error) { console.error('FALLÓ:', label); throw error; }
}
function backend(id=one) { authSession.startBackend(token, user(id)); }
function mock() { demo.login('paciente@ejemplo.com', 'Paciente123'); authSession.startMock(token, user(one)); }
async function main() {
  await check('Mock sin red: catálogos y lecturas del DTO', async () => {
    mock();
    assert.ok((await mockApi.catalog.clinicalParameters()).length > 0);
    assert.ok((await mockApi.readings.list(two)).length > 0);
    assert.ok(readingsToMeasurements(MOCK_READINGS).length > 0);
  });
  await check('Mock sin red: notificaciones y marcado local', async () => {
    mock(); const before = await getNotifications();
    assert.ok(before.length > 0); await markNotificationRead(before[0].id);
    const after = await getNotifications(); assert.equal(after[0].leida, true);
  });
  await check('Sin sesión: no se muestran alertas demo ni lecturas locales', async () => {
    assert.deepEqual(getDemoAlerts(), []);
    await assert.rejects(getAlerts(), e => e.status === 401);
    await assert.rejects(readingsService.detail(two, MOCK_READINGS[0].readingId), e => e.status === 401);
  });
  await check('Backend: alertas mock nunca sustituyen endpoint S4 pendiente', async () => {
    backend(); assert.deepEqual(getDemoAlerts(), []);
    await assert.rejects(getAlerts(), e => e.code === 'FLOW_NOT_AVAILABLE');
  });
  await check('Backend: marcado de notificación no inventa éxito local', async () => {
    backend();
    await assert.rejects(markNotificationRead('id'), e => e.code === 'FLOW_NOT_AVAILABLE');
  });
  await check('Backend: un 503 de notificaciones se propaga', async () => {
    backend(); global.fetch = async () => issue(503, 'AUTHORIZATION_UNAVAILABLE');
    await assert.rejects(getNotifications(), e => e.status === 503);
  });
  await check('Backend: detalle no recupera datos mock tras un 404', async () => {
    backend(); global.fetch = async () => issue(404, 'READING_NOT_FOUND');
    await assert.rejects(readingsService.detail(two, MOCK_READINGS[0].readingId), e => e.status === 404);
  });
  await check('Claves de caché distinguen pacientes sin claves manuales', async () => {
    backend(); let calls=0;
    global.fetch = async () => json({ n: ++calls });
    const a = await dataClient.get('/patients/'+one+'/readings', {retry:false});
    const b = await dataClient.get('/patients/'+two+'/readings', {retry:false});
    const again = await dataClient.get('/patients/'+one+'/readings', {retry:false});
    assert.equal(calls, 2); assert.equal(a.n,1); assert.equal(b.n,2); assert.equal(again.n,1);
  });
  await check('Claves de caché distinguen filtros, página y tamaño', async () => {
    backend(); let calls=0; global.fetch = async () => json({n:++calls});
    const path = '/patients/'+one+'/readings';
    const p1 = await dataClient.get(path,{retry:false,query:{page:1,size:10,parameterCode:'SBP'}});
    await dataClient.get(path,{retry:false,query:{page:2,size:10,parameterCode:'SBP'}});
    await dataClient.get(path,{retry:false,query:{page:1,size:20,parameterCode:'SBP'}});
    await dataClient.get(path,{retry:false,query:{size:10,parameterCode:'SBP',page:1}});
    assert.equal(calls,3); assert.equal(p1.n,1);
  });
  await check('Una key manual no mezcla dos rutas distintas', async () => {
    backend(); let calls=0; global.fetch=async()=>json({n:++calls});
    await dataClient.get('/patients/'+one+'/readings',{retry:false,cache:{key:'shared'}});
    await dataClient.get('/patients/'+two+'/readings',{retry:false,cache:{key:'shared'}});
    assert.equal(calls,2);
  });
  await check('Nuevo usuario no consulta la caché anterior aunque no haya clearCache', async () => {
    backend(one); let calls=0; global.fetch=async()=>json({n:++calls});
    await dataClient.get('/notifications',{retry:false});
    backend(two);
    await dataClient.get('/notifications',{retry:false});
    assert.equal(calls,2);
  });
  await check('ForceRefresh consulta red aunque exista caché fresca', async () => {
    backend(); let calls=0; global.fetch=async()=>json({n:++calls});
    await dataClient.get('/health',{auth:false,retry:false});
    const updated=await dataClient.get('/health',{auth:false,retry:false,cache:{forceRefresh:true}});
    assert.equal(calls,2); assert.equal(updated.n,2);
  });
  await check('El GET concurrente igual comparte una sola consulta', async () => {
    backend(); let release; let calls=0;
    global.fetch = () => { calls++; return new Promise(resolve=>{ release=resolve; }); };
    const p1=dataClient.get('/same',{auth:false,retry:false});
    const p2=dataClient.get('/same',{auth:false,retry:false});
    await tick(); assert.equal(calls,1); release(json({ok:true}));
    assert.deepEqual(await p1,await p2);
  });
  await check('Un forceRefresh no comparte una petición normal en vuelo', async () => {
    backend(); const releases=[];
    global.fetch = () => new Promise(resolve=>{ releases.push(resolve); });
    const older=dataClient.get('/same',{auth:false,retry:false});
    const fresh=dataClient.get('/same',{auth:false,retry:false,cache:{forceRefresh:true}});
    await tick(); assert.equal(releases.length,2);
    releases[1](json({v:'nuevo'})); await fresh;
    releases[0](json({v:'viejo'})); await older;
    assert.equal((await dataClient.get('/same',{auth:false,retry:false})).v,'nuevo');
  });
  await check('Dejar de responder 503 no devuelve caché expirada por defecto', async () => {
    backend(); global.fetch=async()=>json({v:1});
    await dataClient.get('/sensitive',{retry:false,cache:{ttlMs:0}});
    global.fetch=async()=>issue(503,'AUTHORIZATION_UNAVAILABLE');
    await assert.rejects(dataClient.get('/sensitive',{retry:false}),e=>e.status===503);
  });
  await check('Una copia expirada requiere opt-in explícito', async () => {
    backend(); global.fetch=async()=>json({v:1});
    await dataClient.get('/nonsensitive',{retry:false,cache:{ttlMs:0}});
    global.fetch=async()=>issue(503,'SERVICE_UNAVAILABLE');
    const val=await dataClient.get('/nonsensitive',{retry:false,cache:{staleIfErrorMs:5000}});
    assert.equal(val.v,1);
  });
  await check('Un 403 nunca devuelve caché expirada ni la conserva', async () => {
    backend(); global.fetch=async()=>json({v:1});
    await dataClient.get('/clinical',{retry:false,cache:{ttlMs:0}});
    global.fetch=async()=>issue(403,'FORBIDDEN');
    await assert.rejects(dataClient.get('/clinical',{retry:false,cache:{staleIfErrorMs:5000}}),e=>e.status===403);
    assert.equal(dataClient.cacheSize(),0);
  });
  await check('InvalidatePatient borra solo los GET del paciente afectado', async () => {
    backend(); let calls=0; global.fetch=async()=>json({n:++calls});
    const path1='/patients/'+one+'/readings'; const path2='/patients/'+two+'/readings';
    await dataClient.get(path1,{retry:false,query:{page:1}});
    await dataClient.get(path1,{retry:false,query:{page:2}});
    await dataClient.get(path2,{retry:false});
    dataClient.invalidatePatient(one);
    await dataClient.get(path1,{retry:false,query:{page:1}});
    await dataClient.get(path2,{retry:false});
    assert.equal(calls,4);
  });
  await check('Invalidate ruta y filtros borra la variante con custom key', async () => {
    backend(); let calls=0; global.fetch=async()=>json({n:++calls});
    await dataClient.get('/demo',{retry:false,cache:{key:'custom'}});
    dataClient.invalidate('/demo');
    await dataClient.get('/demo',{retry:false,cache:{key:'custom'}});
    assert.equal(calls,2);
  });
  await check('Cambiar sesión durante GET impide publicar respuesta tardía', async () => {
    backend(); let finish;
    global.fetch=()=>new Promise(resolve=>{finish=resolve;});
    const pending=dataClient.get('/patients/'+one+'/readings',{retry:false});
    await tick(); authSession.clear(); finish(json({private:true}));
    await assert.rejects(pending,e=>e.code==='SESSION_CHANGED');
    assert.equal(dataClient.cacheSize(),0);
  });
  console.log(`\n${total} comprobaciones P6 correctas.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{
  global.fetch=oldFetch;global.__DEV__=oldDev;Module._resolveFilename=oldResolve;
  if (oldTs) Module._extensions['.ts']=oldTs; else delete Module._extensions['.ts'];
});
