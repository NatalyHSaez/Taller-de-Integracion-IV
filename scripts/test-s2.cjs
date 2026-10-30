// S2 — Pruebas con HTTP simulado. Ejecutar: node scripts/test-s2.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
const previousFetch = global.fetch;
const previousTs = Module._extensions['.ts'];
Module._resolveFilename = function (request, parent, ...rest) {
  return resolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...rest);
};
Module._extensions['.ts'] = (mod, file) => {
  if (file === path.join(root, 'config/api.ts')) {
    mod.exports = { IS_API_CONFIGURED: true, API_V1_URL: 'http://s2.test/api/v1' }; return;
  }
  if (file === path.join(root, 'services/token-storage.ts')) {
    mod.exports = { getAccessToken: async () => null, getRefreshToken: async () => null,
      saveTokens: async () => {}, clearTokens: async () => {} }; return;
  }
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  mod._compile(compiled.outputText, file);
};
global.__DEV__ = false;
const { authSession } = require('../services/auth-session');
const { patientAccess } = require('../services/patient-access');
const { dataClient } = require('../services/data');
const { demo } = require('../services/demo-store');
const { readingsService } = require('../services/readings');
const { checkReadingDetail, confirmationReasonLabel, evaluationStatusLabel, validReadingId } = require('../services/reading-detail');
const patient = '25b78bc3-8a8d-48d0-8a7c-c9346beae2ed';
const other = '22222222-2222-4222-8222-222222222222';
const rid = '88888888-8888-4888-8888-888888888881';
const rid2 = '88888888-8888-4888-8888-888888888882';
const tokens = { accessToken:'s2-access', refreshToken:'s2-refresh', tokenType:'bearer', expiresIn:3600 };
const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers: {'Content-Type':'application/json'} });
function reading(overrides = {}) {
  return {readingId:rid, patientId:patient, measuredAt:'2026-10-28T16:30:00Z',
    context:null, source:'mobile', status:'PENDING', recordedBy:patient,
    confirmationReasons:[], evaluation:null, measurements:[
      {measurementId:'99999999-9999-4999-8999-999999999991',parameterCode:'SBP',value:120,unit:'mmHg',confirmedByUser:false},
      {measurementId:'99999999-9999-4999-8999-999999999992',parameterCode:'DBP',value:78,unit:'mmHg',confirmedByUser:false},
    ], ...overrides};
}
const backend = () => authSession.startBackend(tokens,{id:patient,fullName:'Paciente',email:'s2@test.local',roles:['PATIENT']});
let passed=0, totalCalls=0;
async function test(name, fn) {
  authSession.clear(); patientAccess.clear(); demo.logout(); dataClient.clearCache(); totalCalls=0;
  global.fetch = async (url) => { throw new Error(`Unexpected request: ${url}`); };
  try { await fn(); ++passed; console.log('OK',name); }
  catch (e) { console.error('FALLÓ',name); throw e; }
}
async function run() {
  await test('Sin sesión rechaza detalle antes de llamar a red',async()=>{
    await assert.rejects(readingsService.detail(patient,rid),e=>e.status===401);
  });
  await test('Cuidador sin paciente elegido no consulta la API',async()=>{
    authSession.startBackend(tokens,{id:other,fullName:'Cuidador',email:'c@test.local',roles:['CAREGIVER']});
    await assert.rejects(readingsService.detail(patient,rid),e=>e.status===403);
  });
  await test('No accede a UUID de otro paciente',async()=>{
    backend(); await assert.rejects(readingsService.detail(other,rid),e=>e.status===403);
  });
  await test('IDs inválidos no llegan al Gateway',async()=>{
    backend(); await assert.rejects(readingsService.detail(patient,'no-uuid'),e=>e.status===422);
    assert.equal(validReadingId(rid),true); assert.equal(validReadingId('abc'),false);
  });
  await test('Detalle real usa ruta por paciente y lectura, no ruta global',async()=>{
    backend(); let url='';global.fetch=async u=>{totalCalls++;url=String(u);return json(reading());};
    const item=await readingsService.detail(patient,rid);
    assert.equal(item.readingId,rid); assert.ok(url.includes(`/patients/${patient}/readings/${rid}`));
    assert.equal(totalCalls,1);
  });
  await test('GET repetido reutiliza caché válida de la misma sesión',async()=>{
    backend();global.fetch=async()=>{totalCalls++;return json(reading());};
    await readingsService.detail(patient,rid);await readingsService.detail(patient,rid);
    assert.equal(totalCalls,1);
  });
  await test('Actualizar manualmente ignora caché y observa evaluación asíncrona',async()=>{
    backend();global.fetch=async()=>{totalCalls++;return json(totalCalls===1 ? reading() : reading({
      status:'EVALUATED',evaluation:{status:'NORMAL',severity:null,explanation:'Evaluación del servidor',evaluatedAt:'2026-10-28T16:35:00Z'}}));};
    const pending=await readingsService.detail(patient,rid);
    const evaluated=await readingsService.detail(patient,rid,true);
    assert.equal(pending.status,'PENDING');assert.equal(evaluated.status,'EVALUATED');
    assert.equal(evaluated.evaluation.explanation,'Evaluación del servidor');assert.equal(totalCalls,2);
  });
  await test('REQUIRES_CONFIRMATION expone motivos y no confirma automáticamente',async()=>{
    backend();global.fetch=async()=>{totalCalls++;return json(reading({
      status:'REQUIRES_CONFIRMATION', confirmationReasons:['UNUSUAL_VALUE:SBP','SBP_NOT_GREATER_THAN_DBP']}));};
    const item=await readingsService.detail(patient,rid);
    assert.equal(item.confirmationReasons.length,2);assert.equal(totalCalls,1);
    assert.ok(confirmationReasonLabel(item.confirmationReasons[0]).includes('sistólica'));
    assert.ok(confirmationReasonLabel(item.confirmationReasons[1]).includes('diastólica'));
    assert.equal(evaluationStatusLabel('ALERTA'),'Alerta');
  });
  await test('Evaluación nullable y campos opcionales nulos se respetan',async()=>{
    const r=checkReadingDetail(reading(),patient,rid);
    assert.equal(r.context,null);assert.equal(r.evaluation,null);
    const evaluated=checkReadingDetail(reading({status:'EVALUATED',evaluation:{
      status:'ADVERTENCIA',severity:null,explanation:null,evaluatedAt:null}}),patient,rid);
    assert.equal(evaluated.evaluation.explanation,null);
  });
  await test('HTTP 404 no se convierte en lectura demo',async()=>{
    backend();global.fetch=async()=>json({detail:'Reading not found',errorCode:'READING_NOT_FOUND'},404);
    await assert.rejects(readingsService.detail(patient,rid),e=>e.status===404);
  });
  await test('HTTP 403 mantiene la denegación y no utiliza un mock',async()=>{
    backend();global.fetch=async()=>json({detail:'Forbidden'},403);
    await assert.rejects(readingsService.detail(patient,rid),e=>e.status===403);
  });
  await test('HTTP 500 se propaga, sin leer registros simulados',async()=>{
    backend();global.fetch=async()=>json({detail:'Internal'},500);
    await assert.rejects(readingsService.detail(patient,rid),e=>e.status===500);
  });
  await test('HTTP 500 en actualización manual no devuelve copia anterior',async()=>{
    backend();global.fetch=async()=>{totalCalls++;return totalCalls===1 ? json(reading()) : json({detail:'Internal'},500);};
    await readingsService.detail(patient,rid);
    await assert.rejects(readingsService.detail(patient,rid,true),e=>e.status===500);
    assert.equal(totalCalls,2);
  });
  await test('Cuerpo de lectura con patientId equivocado se rechaza',async()=>{
    backend();global.fetch=async()=>json(reading({patientId:other}));
    await assert.rejects(readingsService.detail(patient,rid),e=>e.code==='INVALID_API_RESPONSE');
  });
  await test('Cuerpo con readingId diferente se rechaza',async()=>{
    backend();global.fetch=async()=>json(reading({readingId:rid2}));
    await assert.rejects(readingsService.detail(patient,rid),e=>e.code==='INVALID_API_RESPONSE');
  });
  await test('Respuesta malformada nunca se considera lectura válida',async()=>{
    assert.throws(()=>checkReadingDetail({},patient,rid));
    assert.throws(()=>checkReadingDetail(reading({measurements:[{measurementId:'a',parameterCode:'SBP',value:'120',unit:'mmHg',confirmedByUser:false}]}),patient,rid));
    assert.throws(()=>checkReadingDetail(reading({evaluation:{status:'NORMAL',severity:null,explanation:null,evaluatedAt:'not-a-date'}}),patient,rid));
    assert.throws(()=>checkReadingDetail(reading({measurements:[]}),patient,rid));
  });
  await test('Respuesta inválida no contamina caché de próxima solicitud',async()=>{
    backend();global.fetch=async()=>{totalCalls++;return json(totalCalls===1 ? reading({status:'bad'}) : reading());};
    await assert.rejects(readingsService.detail(patient,rid),e=>e.code==='INVALID_API_RESPONSE');
    assert.equal((await readingsService.detail(patient,rid)).status,'PENDING');assert.equal(totalCalls,2);
  });
  await test('Logout durante la consulta impide mostrar información previa',async()=>{
    backend();let release;global.fetch=()=>new Promise(resolve=>{release=resolve;});
    const pending=readingsService.detail(patient,rid);await new Promise(resolve=>setImmediate(resolve));
    authSession.clear();release(json(reading()));
    await assert.rejects(pending,e=>e.code==='SESSION_CHANGED');
  });
  await test('Modo demostración usa sus lecturas y no ejecuta fetch',async()=>{
    demo.login('paciente@ejemplo.com','Paciente123');
    authSession.startMock(tokens,{id:other,fullName:'Juan',email:'paciente@ejemplo.com',roles:['PATIENT']});
    const first=demo.measurements()[0];assert.ok(first);assert.ok(first.readingId);
    const response=await readingsService.detail(first.patientId,first.readingId);
    assert.equal(response.source,'MOCK');assert.equal(response.readingId,first.readingId);
    assert.ok(response.measurements.length>0);
  });
  await test('Mock no accede a lectura de otro paciente',async()=>{
    demo.login('paciente@ejemplo.com','Paciente123');
    authSession.startMock(tokens,{id:other,fullName:'Juan',email:'paciente@ejemplo.com',roles:['PATIENT']});
    await assert.rejects(readingsService.detail(patient,rid),e=>e.status===403);
  });
  await test('Pantalla muestra estado, evaluación, usuario registrador y botón manual',async()=>{
    const code=fs.readFileSync(path.join(root,'app/lectura/[readingId].tsx'),'utf8');
    for (const fragment of ['reading.recordedBy','reading.confirmationReasons','evaluation.explanation','evaluation.evaluatedAt',
      'Actualizar lectura','loadReading(true)','requestSerial.current','reading.status']) assert.ok(code.includes(fragment),fragment);
    assert.ok(!code.includes('setInterval('));
    assert.ok(!code.includes('readingsService.confirm('));
  });
  console.log(`\n${passed} comprobaciones S2 correctas (HTTP simulado).`);
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{
  global.fetch=previousFetch; Module._resolveFilename=resolve; Module._extensions['.ts']=previousTs;
});
