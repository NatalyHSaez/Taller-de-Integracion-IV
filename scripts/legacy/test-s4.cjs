// S4 / TI4-77: integración de alertas clínicas con HTTP simulado, sin modificar Integra II.
// Ejecutar desde la raíz del proyecto: node scripts/test-s4.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...rest);
};
Module._extensions['.ts'] = (mod, file) => {
  if (file === path.join(root, 'config/api.ts')) {
    mod.exports = { IS_API_CONFIGURED: true, API_V1_URL: 'http://s4.test/api/v1' }; return;
  }
  if (file === path.join(root, 'services/token-storage.ts')) {
    mod.exports = { getAccessToken: async () => null, getRefreshToken: async () => null,
      saveTokens: async () => {}, clearTokens: async () => {} }; return;
  }
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  mod._compile(output.outputText, file);
};
global.__DEV__ = false;
const { authSession } = require('../services/auth-session');
const { patientAccess } = require('../services/patient-access');
const { dataClient } = require('../services/data');
const { demo } = require('../services/demo-store');
const { alertsService, getDemoAlerts, getAlerts, checkAlertList } = require('../services/alerts');
const { appState } = require('../services/app-state');
const patient = '25b78bc3-8a8d-48d0-8a7c-c9346beae2ed';
const other = '22222222-2222-4222-8222-222222222222';
const firstId = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const secondId = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
const reading = '88888888-8888-4888-8888-888888888881';
const tokens = { accessToken: 's4-access', refreshToken: 's4-refresh', tokenType: 'bearer', expiresIn: 3600 };
const response = (value, code = 200) => new Response(JSON.stringify(value), { status: code,
  headers: { 'Content-Type': 'application/json' } });
const fail = (status, code) => response({ error: { code, message: 'Error de prueba', details: {}, correlationId: firstId } }, status);
const empty = () => new Response(null, { status: 204 });
const patientUser = () => authSession.startBackend(tokens, {
  id: patient, fullName: 'Paciente', email: 'p@s4.test', roles: ['PATIENT'],
});
const caregiver = () => authSession.startBackend(tokens, {
  id: other, fullName: 'Cuidador', email: 'c@s4.test', roles: ['CAREGIVER'],
});
const alert = (id = firstId, status = 'OPEN', severity = 'ALTA') => ({
  id, readingId: reading, ruleCode: 'HTA_SBP', severity,
  explanation: 'Regla de prueba aplicada a la lectura.', status,
  createdAt: '2026-10-25T13:30:00Z', readAt: status === 'READ' ? '2026-10-25T14:00:00Z' : null,
});
let calls = 0, total = 0;
async function test(label, action) {
  authSession.clear(); patientAccess.clear(); demo.logout(); dataClient.clearCache(); calls = 0;
  global.fetch = async url => { throw Error(`Fetch inesperado: ${url}`); };
  try { await action(); total += 1; console.log('OK', label); }
  catch (error) { console.error('FALLÓ', label); throw error; }
}
async function main() {
  await test('Sin sesión rechaza listado y marcado antes de llamar a la red', async () => {
    await assert.rejects(alertsService.list(patient), e => e.status === 401);
    await assert.rejects(alertsService.markRead(patient, firstId), e => e.status === 401);
  });
  await test('Paciente no puede consultar alertas de un UUID ajeno', async () => {
    patientUser(); await assert.rejects(alertsService.list(other), e => e.status === 403);
    await assert.rejects(alertsService.markRead(other, firstId), e => e.status === 403);
  });
  await test('Cuidador sin selección no consulta alertas del paciente', async () => {
    caregiver(); await assert.rejects(alertsService.list(patient), e => e.status === 403);
  });
  await test('Cuidador vinculado sin ALERT_VIEW no consulta alertas', async () => {
    caregiver(); const rel = { patientId: patient, fullName: 'Paciente',
      relationshipId: '12121212-1212-4212-8212-121212121212', relationshipType: 'CAREGIVER',
      permissions: ['MEASUREMENT_VIEW'], linkedAt: '2026-10-25T00:00:00Z' };
    global.fetch = async () => response([rel]);
    await patientAccess.ensureLoaded(); await patientAccess.select(patient);
    assert.equal(appState.snapshot().permissions.alerts, false);
    await assert.rejects(alertsService.list(patient), e => e.status === 403);
  });
  await test('Cuidador con ALERT_VIEW sí consulta las alertas autorizadas', async () => {
    caregiver(); const rel = { patientId: patient, fullName: 'Paciente',
      relationshipId: '12121212-1212-4212-8212-121212121212', relationshipType: 'CAREGIVER',
      permissions: ['ALERT_VIEW'], linkedAt: '2026-10-25T00:00:00Z' };
    global.fetch = async url => response(String(url).includes('/me/patients') ? [rel] : [alert()]);
    await patientAccess.ensureLoaded(); await patientAccess.select(patient);
    assert.equal((await alertsService.list(patient))[0].id, firstId);
    assert.equal(appState.snapshot().permissions.read, false);
  });
  await test('GET OPEN usa ruta del paciente y consulta status=OPEN', async () => {
    patientUser(); let url = '', authorization = '';
    global.fetch = async (u, init) => { calls++; url = String(u);
      authorization = init.headers.get('Authorization'); return response([alert()]); };
    const result = await alertsService.list(patient);
    assert.equal(result.length, 1); assert.equal(result[0].id, firstId);
    assert.match(url, new RegExp(`/patients/${patient}/alerts\\?status=OPEN`));
    assert.equal(authorization, 'Bearer s4-access'); assert.equal(calls, 1);
  });
  await test('GET READ usa status=READ y mantiene fechas de lectura', async () => {
    patientUser(); let url = '';
    global.fetch = async u => {url = String(u);return response([alert(firstId,'READ')]);};
    const result = await alertsService.list(patient, 'READ');
    assert.match(url,/status=READ/); assert.equal(result[0].readAt,'2026-10-25T14:00:00Z');
  });
  await test('Sin paginación y una respuesta [] representa vacío real', async () => {
    patientUser(); let url = '';
    global.fetch = async u => {url = String(u); return response([]);};
    assert.deepEqual(await alertsService.list(patient), []);
    assert.ok(!url.includes('page=') && !url.includes('size='));
  });
  await test('Valida el filtro OPEN o READ antes de hacer fetch', async () => {
    patientUser(); await assert.rejects(alertsService.list(patient,'PENDING'),e=>e.status===422);
  });
  await test('Detecta lista inválida y no la confunde con lista vacía', async () => {
    patientUser(); global.fetch=async()=>response({items:[]});
    await assert.rejects(alertsService.list(patient),e=>e.code==='INVALID_API_RESPONSE');
  });
  await test('Rechaza campos faltantes, IDs inválidos y duplicados', async () => {
    for (const items of [ [{...alert(), readingId: undefined}],
      [{...alert(), severity: ''}], [{...alert(), id: 'no-uuid'}], [alert(),alert()] ]) {
      assert.throws(()=>checkAlertList(items,'OPEN'),e=>e.code==='INVALID_API_RESPONSE');
    }
  });
  await test('Rechaza estado distinto al filtro y fecha inválida', async () => {
    assert.throws(()=>checkAlertList([alert(firstId,'READ')],'OPEN'));
    assert.throws(()=>checkAlertList([{...alert(),createdAt:'ayer'}],'OPEN'));
    assert.throws(()=>checkAlertList([{...alert(firstId,'READ'),readAt:null}],'READ'));
  });
  await test('Ordena las alertas de la más reciente a la más antigua', async () => {
    const items=checkAlertList([alert(firstId),{...alert(secondId),createdAt:'2026-10-28T13:30:00Z'}],'OPEN');
    assert.deepEqual(items.map(a=>a.id),[secondId,firstId]);
  });
  await test('No confunde severidad clínica con el estado de la alerta', async () => {
    const items=checkAlertList([alert(firstId,'OPEN','MUY_ALTA'),alert(secondId,'OPEN','BAJA')],'OPEN');
    assert.equal(items[0].status,'OPEN'); assert.equal(items[1].severity,'BAJA');
  });
  await test('La caché distingue OPEN y READ sin mezclar resultados', async () => {
    patientUser(); global.fetch=async url => {calls++;return response(String(url).includes('status=READ') ? [alert(firstId,'READ')] : [alert()]);};
    await alertsService.list(patient,'OPEN');await alertsService.list(patient,'OPEN');
    await alertsService.list(patient,'READ'); await alertsService.list(patient,'READ');
    assert.equal(calls,2);
  });
  await test('Actualización forzada ignora la caché y consulta el Gateway', async () => {
    patientUser();global.fetch=async()=>{calls++;return response([alert(calls===1?firstId:secondId)]);};
    assert.equal((await alertsService.list(patient))[0].id,firstId);
    assert.equal((await alertsService.list(patient,'OPEN',true))[0].id,secondId);
    assert.equal(calls,2);
  });
  await test('POST no envía body y acepta 204 sin parsear JSON', async () => {
    patientUser(); let url='', method='', body='not assigned';
    global.fetch=async (u,init)=>{ calls++; url=String(u); method=init.method; body=init.body;return empty();};
    await alertsService.markRead(patient,firstId);
    assert.equal(calls,1);assert.equal(method,'POST');assert.equal(body,undefined);
    assert.ok(url.endsWith(`/patients/${patient}/alerts/${firstId}/read`));
  });
  await test('El marcado real invalida la lista OPEN y READ de caché', async () => {
    patientUser();let marked=false;
    global.fetch=async (u,init)=>{calls++;
      if(init.method==='POST'){marked=true;return empty();}
      return response(String(u).includes('status=READ') ? (marked?[alert(firstId,'READ')]:[]) :
        (marked?[]:[alert()]));};
    assert.equal((await alertsService.list(patient,'OPEN')).length,1);
    assert.equal((await alertsService.list(patient,'READ')).length,0);
    await alertsService.markRead(patient,firstId);
    assert.equal((await alertsService.list(patient,'OPEN')).length,0);
    assert.equal((await alertsService.list(patient,'READ')).length,1);
    assert.equal(calls,5);
  });
  await test('404 ALERT_NOT_FOUND conserva el error y no marca nada', async () => {
    patientUser();global.fetch=async()=>fail(404,'ALERT_NOT_FOUND');
    await assert.rejects(alertsService.markRead(patient,firstId),e=>e.status===404 && e.code==='ALERT_NOT_FOUND');
  });
  await test('403 en lista y marcado nunca usa alertas demo', async () => {
    patientUser();global.fetch=async()=>fail(403,'FORBIDDEN');
    await assert.rejects(alertsService.list(patient),e=>e.status===403);
    await assert.rejects(alertsService.markRead(patient,firstId),e=>e.status===403);
    assert.deepEqual(getDemoAlerts(),[]);
  });
  await test('HTTP 500 se propaga y no se cambia por una alerta simulada', async () => {
    patientUser();global.fetch=async()=>fail(500,'INTERNAL_ERROR');
    await assert.rejects(alertsService.list(patient),e=>e.status===500);
  });
  await test('La falla de red en marcado no inventa confirmación local', async () => {
    patientUser();global.fetch=async()=>{throw Error('Offline');};
    await assert.rejects(alertsService.markRead(patient,firstId));
  });
  await test('Sesión cambiada durante GET impide publicar alertas anteriores', async () => {
    patientUser();let finish;
    global.fetch=()=>new Promise(resolve=>{finish=resolve;});
    const pending=alertsService.list(patient);
    await new Promise(resolve=>setImmediate(resolve));
    authSession.clear();patientAccess.clear();dataClient.clearCache();
    finish(response([alert()]));
    await assert.rejects(pending,e=>e.code==='SESSION_CHANGED');
  });
  await test('Logout mientras POST responde impide actualizar otra sesión', async () => {
    patientUser();let finish;
    global.fetch=()=>new Promise(resolve=>{finish=resolve;});
    const pending=alertsService.markRead(patient,firstId);
    await new Promise(resolve=>setImmediate(resolve));
    authSession.clear();patientAccess.clear();dataClient.clearCache();
    finish(empty());
    await assert.rejects(pending,e=>e.code==='SESSION_CHANGED');
  });
  await test('Modo demo no usa fetch y marcado mueve OPEN a READ', async () => {
    demo.login('paciente@ejemplo.com','Paciente123');
    authSession.startMock(tokens,{id:other,fullName:'Demo',email:'mock@s4.test',roles:['PATIENT']});
    const state=appState.snapshot();assert.ok(state.selectedPatient);
    assert.ok(state.permissions.alerts);
    const demoPatient=state.selectedPatient.id;
    const open=await alertsService.list(demoPatient,'OPEN');
    assert.ok(open.length>0);
    await alertsService.markRead(demoPatient,open[0].id);
    assert.equal((await alertsService.list(demoPatient,'OPEN')).length,0);
    assert.equal((await alertsService.list(demoPatient,'READ')).length,1);
  });
  await test('Modo demo rechaza alerta de otro paciente', async () => {
    demo.login('paciente@ejemplo.com','Paciente123');
    authSession.startMock(tokens,{id:other,fullName:'Demo',email:'mock@s4.test',roles:['PATIENT']});
    await assert.rejects(alertsService.markRead(patient,firstId),e=>e.status===403);
  });
  await test('Al cambiar de sesión demo se reinicia su estado local de leído', async () => {
    demo.login('paciente@ejemplo.com','Paciente123');
    authSession.startMock(tokens,{id:other,fullName:'Demo',email:'mock@s4.test',roles:['PATIENT']});
    const id=appState.snapshot().selectedPatient.id;
    await alertsService.markRead(id,firstId);
    assert.equal((await alertsService.list(id,'OPEN')).length,0);
    authSession.clear(); authSession.startMock(tokens,{id:other,fullName:'Demo',email:'mock@s4.test',roles:['PATIENT']});
    assert.equal((await alertsService.list(id,'OPEN')).length,1);
  });
  await test('La pantalla tiene filtros, marcado y estados sin una ruta GET individual', async () => {
    const source=fs.readFileSync(path.join(root,'app/(tabs)/alertas.tsx'),'utf8');
    assert.match(source,/Abiertas/); assert.match(source,/Leídas/);
    assert.match(source,/Marcar como leída/); assert.match(source,/marcarLeida/);
    assert.match(source,/useAppState/); assert.match(source,/RefreshControl/);
    assert.ok(!source.includes('getDemoAlerts'));
    assert.ok(!source.includes('setInterval('));
  });
  console.log(`\n${total} comprobaciones S4 correctas (HTTP simulado).`);
}
main().catch(error=>{ console.error(error); process.exitCode=1; }).finally(()=>{global.fetch=undefined;});
