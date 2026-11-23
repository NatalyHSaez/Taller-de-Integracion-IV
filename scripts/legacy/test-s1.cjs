// S1 — Pruebas sin Docker ni Expo Go. Ejecutar: node scripts/test-s1.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
const extension = Module._extensions['.ts'];
const previousFetch = global.fetch;
Module._resolveFilename = function(request, parent, ...rest) {
  return resolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...rest);
};
Module._extensions['.ts'] = (mod, file) => {
  if (file === path.join(root, 'config/api.ts')) {
    mod.exports = { IS_API_CONFIGURED: true, API_V1_URL: 'http://s1.test/api/v1' }; return;
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
const { checkHistoryPage, mergeHistoryPages, historyCards, localDateRange, withoutStandalonePulse } = require('../services/readings-history');
const patient = '25b78bc3-8a8d-48d0-8a7c-c9346beae2ed';
const other = '22222222-2222-4222-8222-222222222222';
const token = { accessToken:'s1-access', refreshToken:'s1-refresh', tokenType:'bearer', expiresIn:3600 };
const json = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers: {'Content-Type':'application/json'},
});
function reading(id, overrides={}) {
  return { readingId:id, patientId:patient, measuredAt:'2026-10-28T16:30:00Z',
    context:null, source:'mobile', status:'EVALUATED', recordedBy:patient,
    confirmationReasons:[], evaluation:null, measurements:[
      {measurementId:`${id}-sbp`,parameterCode:'SBP',value:120,unit:'mmHg',confirmedByUser:false},
      {measurementId:`${id}-dbp`,parameterCode:'DBP',value:78,unit:'mmHg',confirmedByUser:false},
    ], ...overrides };
}
const page = (items, number=1, total=items.length, size=20) => ({items,page:number,total,size});
const paths=[];
function backend() {
  authSession.startBackend(token, {id:patient,fullName:'Paciente',email:'s1@test.local',roles:['PATIENT']});
}
let passed=0;
async function test(name, fn) {
  authSession.clear(); patientAccess.clear(); demo.logout(); dataClient.clearCache(); paths.length=0;
  global.fetch = async (url) => {throw Error(`Petición no esperada: ${url}`);};
  try { await fn(); passed++; console.log('OK',name); }
  catch(e){ console.error('FALLÓ',name); throw e; }
}
async function run(){
  await test('Sin sesión no permite consultar historial',async()=>{
    await assert.rejects(readingsService.list(patient),e=>e.status===401);
  });
  await test('Cuidador sin paciente activo no puede consultar historial',async()=>{
    authSession.startBackend(token, {id:other,fullName:'Cuidador',email:'care@test.local',roles:['CAREGIVER']});
    await assert.rejects(readingsService.list(patient), e=>e.status===403);
  });
  await test('Modo demo no consulta la red del backend',async()=>{
    demo.login('paciente@ejemplo.com','Paciente123'); authSession.startMock(token,{id:patient,fullName:'Demo',email:'d@d.cl',roles:['PATIENT']});
    await assert.rejects(readingsService.list(patient),e=>e.status===401);
    assert.ok(demo.measurements().length>0);
  });
  await test('Paciente: page=1, size=20 y UUID correcto',async()=>{
    backend(); global.fetch=async url=>{paths.push(String(url));return json(page([reading('r1')],1,1));};
    const r=await readingsService.list(patient);
    assert.equal(r.items[0].readingId,'r1'); assert.equal(paths.length,1);
    assert.ok(paths[0].includes(`/patients/${patient}/readings`));
    assert.ok(paths[0].includes('page=1')); assert.ok(paths[0].includes('size=20'));
  });
  await test('Filtros combinados viajan correctamente al Gateway',async()=>{
    backend(); global.fetch=async url=>{paths.push(String(url));return json(page([],2,22));};
    await readingsService.list(patient,2,{parameterCode:'GLUCOSE',from:'2026-10-01T03:00:00Z',to:'2026-10-31T02:59:59Z'});
    assert.ok(paths[0].includes('parameterCode=GLUCOSE')); assert.ok(paths[0].includes('from=2026-10-01'));
    assert.ok(paths[0].includes('to=2026-10-31')); assert.ok(paths[0].includes('page=2'));
  });
  await test('Distintas páginas no comparten caché',async()=>{
    backend(); let calls=0;
    global.fetch=async url=>{calls++;const u=new URL(url); const n=Number(u.searchParams.get('page')); return json(page([reading(`r${n}`)],n,21));};
    assert.equal((await readingsService.list(patient,1)).items[0].readingId,'r1');
    assert.equal((await readingsService.list(patient,2)).items[0].readingId,'r2');
    assert.equal((await readingsService.list(patient,1)).items[0].readingId,'r1');
    assert.equal(calls,2);
  });
  await test('Distintos filtros no comparten caché',async()=>{
    backend(); let count=0;global.fetch=async()=>json(page([reading(`r${++count}`)]));
    await readingsService.list(patient,1,{parameterCode:'SBP'});
    await readingsService.list(patient,1,{parameterCode:'GLUCOSE'});
    assert.equal(count,2);
  });
  await test('Actualización manual ignora caché fresca',async()=>{
    backend();let count=0; global.fetch=async()=>json(page([reading(`r${++count}`)]));
    await readingsService.list(patient); await readingsService.list(patient,1,{},true);
    assert.equal(count,2);
  });
  await test('403 real se propaga sin lecturas de demostración',async()=>{
    backend(); global.fetch=async()=>json({detail:'Forbidden',errorCode:'FORBIDDEN'},403);
    await assert.rejects(readingsService.list(patient),e=>e.status===403);
  });
  await test('500 real de Seguimiento se propaga',async()=>{
    backend(); global.fetch=async()=>json({detail:'error'},500);
    await assert.rejects(readingsService.list(patient),e=>e.status===500);
  });
  await test('No permite consultar otro UUID aunque exista sesión',async()=>{
    backend(); await assert.rejects(readingsService.list(other),e=>e.status===403);
  });
  await test('Cambio de sesión durante la petición no publica respuesta',async()=>{
    backend();let release;
    global.fetch=()=>new Promise(resolve=>{release=resolve;});
    const pending=readingsService.list(patient); await new Promise(resolve=>setImmediate(resolve));
    authSession.clear(); release(json(page([reading('r1')])));
    await assert.rejects(pending,e=>e.code==='SESSION_CHANGED');
  });
  await test('Respuesta de otro paciente se rechaza',async()=>{
    backend();global.fetch=async()=>json(page([reading('r1',{patientId:other})]));
    await assert.rejects(readingsService.list(patient),e=>e.code==='INVALID_API_RESPONSE');
  });
  await test('Respuesta malformada no se considera vacía',async()=>{
    assert.throws(()=>checkHistoryPage({items:[],page:1,size:20},patient,1));
    assert.throws(()=>checkHistoryPage(page([reading('r1')],2,1),patient,1));
  });
  await test('Páginas solapadas no duplican readingId',async()=>{
    const first=[reading('r1'),reading('r2')];const second=[reading('r2'),reading('r3')];
    assert.deepEqual(mergeHistoryPages(first,second).map(r=>r.readingId),['r1','r2','r3']);
  });
  await test('Presión SBP y DBP comparten tarjeta con readingId original',async()=>{
    const cards=historyCards([reading('r1',{status:'PENDING'})]);
    assert.equal(cards.length,1);assert.equal(cards[0].readingId,'r1');
    assert.equal(cards[0].systolic,120);assert.equal(cards[0].diastolic,78);
    assert.equal(cards[0].readingStatus,'PENDING'); assert.equal(cards[0].heartRate,undefined);
  });
  await test('Una lectura con presión, pulso, glucosa y peso respeta filtros',async()=>{
    const r=reading('r2');r.measurements.push(
      {measurementId:'hr',parameterCode:'HEART_RATE',value:70,unit:'bpm'},
      {measurementId:'g',parameterCode:'GLUCOSE',value:108,unit:'mg/dL'},
      {measurementId:'w',parameterCode:'WEIGHT',value:70,unit:'kg'});
    assert.equal(historyCards([r]).length,3);
    assert.equal(historyCards([r],'GLUCOSE').length,1);
    assert.equal(historyCards([r],'HEART_RATE')[0].type,'heart_rate');
    assert.equal(historyCards([r],'SBP')[0].type,'blood_pressure');
  });
  await test('El historial no ofrece Pulso como filtro independiente',async()=>{
    const source=fs.readFileSync(path.join(root,'app/historial.tsx'),'utf8');
    assert.ok(!source.includes("label: 'Pulso'"));
    assert.ok(!source.includes("code: 'HEART_RATE'"));
    assert.ok(source.includes('withoutStandalonePulse(mockMeasurements)'));
    assert.ok(source.includes('withoutStandalonePulse(historyCards('));
    assert.ok(source.includes('historial de presión arterial, glucosa y peso'));
  });
  await test('El frontend conserva la frecuencia cardíaca en la tarjeta de presión',async()=>{
    const r=reading('rr'); r.measurements.push({measurementId:'hr',parameterCode:'HEART_RATE',value:73,unit:'bpm'});
    const cards=withoutStandalonePulse(historyCards([r]));
    assert.equal(cards.length,1);
    assert.equal(cards[0].type,'blood_pressure');
    assert.equal(cards[0].heartRate,73);
    const demoCards=withoutStandalonePulse([
      {id:'p',type:'blood_pressure',systolic:125,diastolic:80,heartRate:72,measuredAt:'2026-10-28T09:00:00Z'},
      {id:'hr',type:'heart_rate',value:72,unit:'bpm',measuredAt:'2026-10-28T09:00:00Z'},
    ]);
    assert.deepEqual(demoCards.map(m=>m.type),['blood_pressure']);
    assert.equal(demoCards[0].heartRate,72);
  });
  await test('Una lectura con solo frecuencia cardíaca no produce tarjeta independiente',async()=>{
    const onlyPulse=reading('hr-only',{measurements:[
      {measurementId:'hr',parameterCode:'HEART_RATE',value:75,unit:'bpm',confirmedByUser:false},
    ]});
    assert.equal(historyCards([onlyPulse])[0].type,'heart_rate');
    assert.equal(withoutStandalonePulse(historyCards([onlyPulse])).length,0);
    assert.equal(onlyPulse.measurements[0].parameterCode,'HEART_RATE');
  });
  await test('Estados pendientes, confirmación y evaluadas se conservan',async()=>{
    const entries=[reading('rA',{status:'PENDING'}),reading('rB',{status:'REQUIRES_CONFIRMATION'}),reading('rC',{status:'EVALUATED'})];
    assert.deepEqual(historyCards(entries).map(m=>m.readingStatus),['PENDING','REQUIRES_CONFIRMATION','EVALUATED']);
  });
  await test('Si falta una presión no inventa el otro valor',async()=>{
    const r=reading('r3',{measurements:[{measurementId:'s',parameterCode:'SBP',value:122,unit:'mmHg'}]});
    assert.equal(historyCards([r])[0].type,'single_pressure');
  });
  await test('Rango de fechas válido y formato inclusivo',async()=>{
    const range=localDateRange('2026-10-01','2026-10-28');
    assert.ok(new Date(range.from).getTime()<new Date(range.to).getTime());
    assert.throws(()=>localDateRange('2026-02-30',''));
    assert.throws(()=>localDateRange('2026-10-28','2026-10-01'));
  });
  console.log(`\n${passed} comprobaciones S1 correctas (HTTP simulado).`);
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{
  global.fetch=previousFetch; Module._resolveFilename=resolve;
  if(extension) Module._extensions['.ts']=extension;
});
