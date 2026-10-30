// S3 — Pruebas con HTTP simulado y sin modificar Integra II.
// Ejecutar desde la raíz: node scripts/test-s3.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
const originalTs = Module._extensions['.ts'];
const originalFetch = global.fetch;
Module._resolveFilename = function (request, parent, ...rest) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...rest);
};
Module._extensions['.ts'] = (mod, file) => {
  if (file === path.join(root, 'config/api.ts')) {
    mod.exports = { IS_API_CONFIGURED: true, API_V1_URL: 'http://s3.test/api/v1' }; return;
  }
  if (file === path.join(root, 'services/token-storage.ts')) {
    mod.exports = { getAccessToken: async () => null, getRefreshToken: async () => null,
      saveTokens: async () => {}, clearTokens: async () => {} }; return;
  }
  const source = fs.readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(source, { fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  mod._compile(compiled.outputText, file);
};
global.__DEV__ = false;
const { authSession } = require('../services/auth-session');
const { patientAccess } = require('../services/patient-access');
const { dataClient } = require('../services/data');
const { demo } = require('../services/demo-store');
const { measurementSeriesService, checkMeasurementSeries,
  demoMeasurementSeries, mergeMeasurementSeries } = require('../services/measurement-series');
const { localDateRange } = require('../services/readings-history');
const patient = '25b78bc3-8a8d-48d0-8a7c-c9346beae2ed';
const other = '22222222-2222-4222-8222-222222222222';
const r1 = '88888888-8888-4888-8888-888888888881';
const r2 = '88888888-8888-4888-8888-888888888882';
const tokens = { accessToken: 's3-access', refreshToken: 's3-refresh', tokenType: 'bearer', expiresIn: 3600 };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status,
  headers: { 'Content-Type': 'application/json' } });
const point = (parameterCode, value, readingId = r1, measuredAt = '2026-10-25T12:00:00Z') => ({
  readingId, measuredAt, parameterCode, value,
  unit: ({ SBP:'mmHg', DBP:'mmHg', HEART_RATE:'bpm', GLUCOSE:'mg/dL', WEIGHT:'kg' })[parameterCode],
});
const backend = () => authSession.startBackend(tokens, {
  id: patient, fullName: 'Paciente', email: 's3@local.test', roles: ['PATIENT'],
});
let count = 0;
let fetchCalls = 0;
async function test(name, fn) {
  authSession.clear(); patientAccess.clear(); demo.logout(); dataClient.clearCache(); fetchCalls = 0;
  global.fetch = async (url) => { throw new Error(`Unexpected fetch: ${url}`); };
  try { await fn(); count++; console.log('OK', name); }
  catch (e) { console.error('FALLÓ', name); throw e; }
}
async function run() {
  await test('Sin sesión se rechaza la serie antes de consultar la red', async () => {
    await assert.rejects(measurementSeriesService.list(patient, 'glucose'), e => e.status === 401);
  });
  await test('Demo nunca se comunica con la API de series reales', async () => {
    authSession.startMock(tokens, { id: patient, fullName:'Demo', email:'demo@local.test', roles:['PATIENT'] });
    await assert.rejects(measurementSeriesService.list(patient, 'weight'), e => e.status === 401);
    assert.equal(fetchCalls, 0);
  });
  await test('Cuidador sin paciente seleccionado no consulta series ajenas', async () => {
    authSession.startBackend(tokens, { id:other, fullName:'Cuidador', email:'c@local.test', roles:['CAREGIVER'] });
    await assert.rejects(measurementSeriesService.list(patient, 'blood_pressure'), e => e.status === 403);
  });
  await test('Paciente real no consulta el UUID de otra persona', async () => {
    backend(); await assert.rejects(measurementSeriesService.list(other, 'weight'), e => e.status === 403);
  });
  await test('Rechaza UUID y grupo desconocidos', async () => {
    backend(); await assert.rejects(measurementSeriesService.list('otro', 'weight'), e => e.status === 403);
    await assert.rejects(measurementSeriesService.list(patient, 'xx'), e => e.status === 422);
  });
  await test('Presión consulta SBP y DBP, usando los códigos del contrato', async () => {
    backend(); const urls = [];
    global.fetch = async url => { fetchCalls++; urls.push(String(url));
      return json(String(url).includes('parameterCode=SBP') ? [point('SBP',120)] : [point('DBP',82)]); };
    const items = await measurementSeriesService.list(patient, 'blood_pressure');
    assert.equal(fetchCalls, 2);
    assert.ok(urls.every(u => u.includes(`/patients/${patient}/measurements`)));
    assert.ok(urls.some(u => u.includes('parameterCode=SBP')));
    assert.ok(urls.some(u => u.includes('parameterCode=DBP')));
    assert.deepEqual(items.map(p => p.parameterCode).sort(), ['DBP','SBP']);
    assert.equal(items[0].readingId, r1);
  });
  await test('Glucosa consulta solo GLUCOSE, sin paginación', async () => {
    backend(); let url = '';
    global.fetch = async u => { fetchCalls++; url = String(u); return json([point('GLUCOSE',111)]); };
    assert.equal((await measurementSeriesService.list(patient, 'glucose'))[0].value,111);
    assert.ok(url.includes('parameterCode=GLUCOSE'));
    assert.ok(!url.includes('page=') && !url.includes('size='));
    assert.equal(fetchCalls,1);
  });
  await test('Peso consulta solo WEIGHT y conserva unidad original', async () => {
    backend(); global.fetch = async u => { fetchCalls++; return json([point('WEIGHT',68.4)]); };
    const items = await measurementSeriesService.list(patient, 'weight');
    assert.equal(items[0].unit,'kg'); assert.equal(fetchCalls,1);
  });
  await test('Serie vacía representa vacío real, no puntos demo', async () => {
    backend(); global.fetch = async () => {fetchCalls++; return json([]);};
    assert.deepEqual(await measurementSeriesService.list(patient,'glucose'), []);
  });
  await test('Filtro desde/hasta se envía en formato ISO al Gateway', async () => {
    backend(); let url = '';
    const dates = { from:'2026-10-24T00:00:00.000Z', to:'2026-10-27T23:59:59.999Z' };
    global.fetch = async u => {url=String(u); return json([point('GLUCOSE',115)]);};
    await measurementSeriesService.list(patient,'glucose',dates);
    assert.ok(url.includes('from=') && url.includes('to='));
    assert.ok(url.includes('2026-10-24T00%3A00%3A00'));
  });
  await test('Fechas inválidas se rechazan antes de hacer fetch', async () => {
    backend(); await assert.rejects(measurementSeriesService.list(patient,'weight',{ from:'2026-02-30' }),e=>e.status===422);
    await assert.rejects(measurementSeriesService.list(patient,'weight',{
      from:'2026-10-28T00:00:00Z',to:'2026-10-20T00:00:00Z'}),e=>e.status===422);
  });
  await test('La conversión de fechas locales conserva día completo y detecta imposibles', async () => {
    const dates = localDateRange('2026-10-20','2026-10-28');
    assert.ok(dates.from && dates.to);
    assert.ok(Date.parse(dates.from)<Date.parse(dates.to));
    assert.throws(()=>localDateRange('2026-02-30',''), /existe/);
  });
  await test('Respuesta de serie inválida no se confunde con datos vacíos', async () => {
    backend(); global.fetch = async()=> json({items:[]});
    await assert.rejects(measurementSeriesService.list(patient,'glucose'),e=>e.code==='INVALID_API_RESPONSE');
  });
  await test('No acepta datos sin readingId o valor numérico', async () => {
    assert.throws(()=>checkMeasurementSeries([{...point('WEIGHT',70),readingId:null}],'WEIGHT'));
    assert.throws(()=>checkMeasurementSeries([{...point('WEIGHT',70),value:'70'}],'WEIGHT'));
    assert.throws(()=>checkMeasurementSeries([{...point('WEIGHT',70),value:Infinity}],'WEIGHT'));
  });
  await test('No acepta parámetro ni unidad diferente a los solicitados', async () => {
    assert.throws(()=>checkMeasurementSeries([point('SBP',125)],'DBP'));
    assert.throws(()=>checkMeasurementSeries([{...point('GLUCOSE',98),unit:'mmHg'}],'GLUCOSE'));
  });
  await test('No acepta puntos fuera del rango aplicado', async () => {
    assert.throws(()=>checkMeasurementSeries([point('WEIGHT',70)],'WEIGHT',{
      from:'2026-10-26T00:00:00Z'}));
  });
  await test('Puntos se ordenan ascendente y mantienen lectura original', async () => {
    const sorted = checkMeasurementSeries([point('GLUCOSE',105,r2,'2026-10-26T09:00:00Z'),
      point('GLUCOSE',99,r1,'2026-10-25T09:00:00Z')], 'GLUCOSE');
    assert.deepEqual(sorted.map(p=>p.readingId),[r1,r2]);
  });
  await test('Dos mediciones del mismo readingId no se duplican', async () => {
    assert.throws(()=>checkMeasurementSeries([point('SBP',120),point('SBP',130)],'SBP'));
  });
  await test('Presión incompleta no inventa el valor faltante', async () => {
    const values=mergeMeasurementSeries([[point('SBP',123)],[point('DBP',75,r2)]]);
    assert.equal(values.filter(p=>p.parameterCode==='SBP').length,1);
    assert.equal(values.filter(p=>p.parameterCode==='DBP').length,1);
    assert.notEqual(values[0].readingId,values[1].readingId);
  });
  await test('Caché separa parámetros distintos y reutiliza el mismo filtro', async () => {
    backend(); global.fetch = async url => {fetchCalls++; return json(String(url).includes('GLUCOSE') ?
      [point('GLUCOSE',99)] : [point('WEIGHT',66)]);};
    await measurementSeriesService.list(patient,'glucose');
    await measurementSeriesService.list(patient,'glucose');
    await measurementSeriesService.list(patient,'weight');
    assert.equal(fetchCalls,2);
  });
  await test('Actualización manual ignora caché fresca', async () => {
    backend();global.fetch=async()=>{fetchCalls++;return json([point('GLUCOSE',90+fetchCalls)]);};
    const a=await measurementSeriesService.list(patient,'glucose');
    const b=await measurementSeriesService.list(patient,'glucose',{},true);
    assert.equal(a[0].value,91);assert.equal(b[0].value,92);assert.equal(fetchCalls,2);
  });
  await test('Un HTTP 403 se propaga sin usar mediciones de demostración', async () => {
    backend();global.fetch=async()=>json({errorCode:'FORBIDDEN',detail:'sin permiso'},403);
    await assert.rejects(measurementSeriesService.list(patient,'weight'),e=>e.status===403);
  });
  await test('HTTP 500 de Seguimiento se propaga y no inventa puntos', async () => {
    backend();global.fetch=async()=>json({detail:'error interno'},500);
    await assert.rejects(measurementSeriesService.list(patient,'glucose'),e=>e.status===500);
  });
  await test('Invalidación de respuesta malformada permite volver a consultar', async () => {
    backend();global.fetch=async()=>{fetchCalls++;return json(fetchCalls===1 ? [point('WEIGHT','bad')] : [point('WEIGHT',72)]);};
    await assert.rejects(measurementSeriesService.list(patient,'weight'),e=>e.code==='INVALID_API_RESPONSE');
    assert.equal((await measurementSeriesService.list(patient,'weight'))[0].value,72);
    assert.equal(fetchCalls,2);
  });
  await test('Cambio de sesión durante GET evita publicar respuesta antigua', async () => {
    backend();let reply;
    global.fetch=async()=>new Promise(resolve=>{reply=resolve;});
    const pending=measurementSeriesService.list(patient,'glucose');
    for(let attempt=0;attempt<40 && !reply;attempt++) await new Promise(resolve=>setImmediate(resolve));
    assert.ok(reply);authSession.clear();reply(json([point('GLUCOSE',101)]));
    await assert.rejects(pending,e=>e.code==='SESSION_CHANGED');
  });
  await test('Demo reproduce sistólica/diastólica y no ofrece pulso independiente', async () => {
    const measurements=[{id:'demo-1',readingId:'demo-reading',patientId:patient,type:'blood_pressure',
      measuredAt:'2026-10-25T12:00:00Z',systolic:120,diastolic:80,heartRate:74}];
    const values=demoMeasurementSeries(measurements,patient,'blood_pressure');
    assert.deepEqual(values.map(p=>p.parameterCode).sort(),['DBP','SBP']);
    assert.equal(values.some(p=>p.parameterCode==='HEART_RATE'),false);
  });
  await test('Demo acepta fechas locales existentes sin zona horaria', async () => {
    const values=demoMeasurementSeries([{ id:'m1', type:'blood_pressure', patientId:patient,
      measuredAt:'2026-09-23T10:30:00', systolic:128, diastolic:82, heartRate:72 }],patient,'blood_pressure');
    assert.equal(values.length,2);
  });
  await test('Demo respeta paciente, fechas y glucosa sin contactar la red', async () => {
    const measurements=[
      {id:'d1',patientId:other,type:'glucose',value:222,unit:'mg/dL',measuredAt:'2026-10-25T12:00:00Z'},
      {id:'d2',patientId:patient,type:'glucose',value:105,unit:'mg/dL',measuredAt:'2026-10-25T12:00:00Z'},
      {id:'d3',patientId:patient,type:'glucose',value:111,unit:'mg/dL',measuredAt:'2026-10-20T12:00:00Z'},
    ];
    const result=demoMeasurementSeries(measurements,patient,'glucose',{from:'2026-10-23T00:00:00Z'});
    assert.deepEqual(result.map(p=>p.value),[105]);assert.equal(fetchCalls,0);
  });
  await test('Pantalla integra carga, vacío, errores y fechas sin importar datos demo en backend', async () => {
    const src=fs.readFileSync(path.join(root,'app/(tabs)/graficos.tsx'),'utf8');
    assert.ok(src.includes('measurementSeriesService.list('));
    assert.ok(src.includes('demoMeasurementSeries('));
    assert.ok(src.includes('if (active) void load()'));
    assert.ok(src.includes('visible.error'));
    assert.ok(src.includes('No se encontraron registros'));
    assert.ok(src.includes('localDateRange(fromInput, toInput)'));
    assert.ok(src.includes('Actualizar gráficos'));
    assert.ok(!src.includes("value: 'heart_rate'"));
  });
  console.log(`\n${count} comprobaciones S3 correctas (HTTP simulado).`);
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{
  global.fetch=originalFetch;
  Module._resolveFilename=originalResolve;
  Module._extensions['.ts']=originalTs;
});
