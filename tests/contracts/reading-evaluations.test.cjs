const test = require('node:test');
const assert = require('node:assert/strict');
const { isReadingEvaluation, hasValidReadingEvaluation } = projectRequire('src/modules/monitoring/domain/reading-query.ts');
const { checkReadingDetail } = projectRequire('src/modules/monitoring/application/use-cases/reading-detail.ts');
const { checkHistoryPage } = projectRequire('src/modules/monitoring/application/use-cases/readings-history.ts');
const { createReadingFlow } = projectRequire('src/modules/monitoring/application/flows/reading-flow.ts');
const ev = {status:'ADVERTENCIA',severity:'MEDIA',explanation:null,evaluatedAt:'2026-11-24T23:12:00Z'};
const row = {readingId:'r1',patientId:'p1',measuredAt:'2026-11-24T23:12:00Z',status:'EVALUATED',confirmationReasons:[],measurements:[{measurementId:'m1',parameterCode:'WEIGHT',value:81,unit:'kg',confirmedByUser:false}],evaluation:ev};
test('evaluación: acepta estados y severidades actuales y campos nulos',()=>{
  for(const status of ['NORMAL','ADVERTENCIA','ALERTA']) for(const severity of ['BAJA','MEDIA','ALTA','MUY_ALTA',null]) assert.ok(isReadingEvaluation({...ev,status,severity}));
  assert.ok(isReadingEvaluation({...ev,evaluatedAt:null}));
});
test('evaluación: rechaza estados antiguos, severidades inválidas y campos ausentes',()=>{
  for(const bad of [{...ev,status:'INFORMATIVA'},{...ev,severity:'ALERTA'},{...ev,explanation:undefined},{...ev,evaluatedAt:undefined},{...ev,severity:undefined},{...ev,evaluatedAt:'invalid'}]) assert.equal(isReadingEvaluation(bad),false);
});
test('evaluación: lectura procesada sin resultado no implica normalidad',()=>{
  assert.ok(hasValidReadingEvaluation('EVALUATED',null));
  assert.equal(checkReadingDetail({...row,evaluation:null},'p1','r1').evaluation,null);
});
test('evaluación: historial y detalle aplican la misma validación',()=>{
  for(const bad of [{...row,status:'PENDING'},{...row,status:'REQUIRES_CONFIRMATION'},{...row,evaluation:{...ev,status:'UNKNOWN'}}]) {
    assert.throws(()=>checkReadingDetail(bad,'p1','r1'),{code:'INVALID_API_RESPONSE'});
    assert.throws(()=>checkHistoryPage({total:1,page:1,size:20,items:[bad]},'p1',1),{code:'INVALID_API_RESPONSE'});
  }
  assert.deepEqual(checkHistoryPage({total:1,page:1,size:20,items:[row]},'p1',1).items[0].evaluation,ev);
});
test('evaluación: flujo conserva resultado recibido al actualizar y no inventa un resultado nulo',async()=>{
  let result = {readingId:'r1',status:'EVALUATED',evaluation:ev};
  const flow = createReadingFlow({create:async()=>({readingId:'r1',status:'PENDING',evaluation:null}),status:async()=>result,confirm:async()=>result});
  await flow.submit('p1',{});
  assert.equal(flow.getState().reading.evaluation,null);
  await flow.refresh();
  assert.deepEqual(flow.getState().reading.evaluation,ev);
  result={readingId:'r1',status:'EVALUATED',evaluation:null};
  await flow.refresh();
  assert.equal(flow.getState().reading.evaluation,null);
});
