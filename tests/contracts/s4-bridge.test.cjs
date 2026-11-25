/* global projectRequire, mockModule */
'use strict';
/** S4: contrato y comportamiento de alertas clínicas en la arquitectura modular. */
const test = require('node:test');
const assert = require('node:assert/strict');
const calls = {get:[], post:[]};
let getReply = [];
let postReply;
mockModule('src/core/infrastructure/http/api-client.ts', {
  apiClient: {
    get: async (path, options) => { calls.get.push({path, options}); return getReply; },
    post: async (path, body) => { calls.post.push({path, body}); return postReply; },
  },
});
const { checkAlertList, backendAlertsService } = projectRequire('src/modules/evaluation/infrastructure/api/alerts-api.ts');
const { createPatientAlerts, classifyAlertError } = projectRequire('src/modules/evaluation/application/use-cases/patient-alerts.ts');
const P1 = '25b78bc3-8a8d-48d0-8a7c-c9346beae2ed';
const P2 = '22222222-2222-4222-8222-222222222222';
const A1 = '88888888-8888-4888-8888-888888888881';
const A2 = '88888888-8888-4888-8888-888888888882';
const NOW = new Date('2026-11-23T16:45:00.000Z');
const alert = (id=A1, status='OPEN', overrides={}) => ({
  id, readingId:'11111111-1111-4111-8111-111111111111',
  ruleCode:'HTA_ALERT', severity:'ALTA', explanation:'Alerta de prueba', status,
  createdAt:'2026-11-22T15:00:00Z', readAt:status==='READ'?'2026-11-23T10:00:00Z':null,
  ...overrides,
});
const invalid = (raw, status) => assert.throws(() => checkAlertList(raw, status), e => e.code==='INVALID_API_RESPONSE');

test('S4: respuesta vacía [] es válida, pero null u objeto paginado son inválidos', () => {
  assert.deepEqual(checkAlertList([], 'OPEN'), []);
  for (const raw of [null, {}, {items:[]}, '[]']) invalid(raw);
});
test('S4: rechaza alertas duplicadas, identificador vacío y severidad sin definir', () => {
  invalid([alert(), alert()]);
  invalid([alert('', 'OPEN')]);
  invalid([alert(A1, 'OPEN', {severity:''})]);
  invalid([alert(A1, 'OPEN', {ruleCode:''})]);
});
test('S4: diferencia estado de alerta y severidad clínica, sin inventar explicación', () => {
  const checked = checkAlertList([alert(A1,'OPEN',{severity:'CRITICA',explanation:''})],'OPEN');
  assert.equal(checked[0].status,'OPEN');
  assert.equal(checked[0].severity,'CRITICA');
  assert.equal(checked[0].explanation,'');
});
test('S4: rechaza estado ajeno al filtro o fecha inválida', () => {
  invalid([alert(A1,'READ')],'OPEN');
  invalid([alert(A1,'OPEN',{createdAt:'ayer'})],'OPEN');
  invalid([alert(A1,'READ',{readAt:'no es fecha'})],'READ');
});
test('S4: la lista ordena las alertas recientes sin convertir su fecha', () => {
  const sorted = checkAlertList([
    alert(A1,'OPEN',{createdAt:'2026-11-20T10:00:00Z'}),
    alert(A2,'OPEN',{createdAt:'2026-11-22T10:00:00Z'}),
  ]);
  assert.deepEqual(sorted.map(x => x.id), [A2,A1]);
});
test('S4: GET consulta filtro en el Gateway, POST acepta 204 sin contenido', async () => {
  calls.get.length = 0; calls.post.length = 0;
  getReply = [alert()]; postReply = undefined;
  assert.equal((await backendAlertsService.list('paciente especial','OPEN'))[0].id,A1);
  assert.equal(calls.get[0].path,'/patients/paciente%20especial/alerts');
  assert.deepEqual(calls.get[0].options.query, {status:'OPEN'});
  await backendAlertsService.markRead('paciente especial','alerta especial');
  assert.equal(calls.post[0].path,'/patients/paciente%20especial/alerts/alerta%20especial/read');
  assert.equal(calls.post[0].body,undefined);
});
test('S4: marcado no acepta JSON inesperado en lugar de 204', async () => {
  postReply = {ok:true};
  await assert.rejects(backendAlertsService.markRead(P1,A1), e => e.code==='INVALID_API_RESPONSE');
  postReply=undefined;
});
test('S4: estados de sesión, permisos y alerta inexistente se distinguen', () => {
  const { ApiError } = projectRequire('src/core/infrastructure/http/errors/index.ts');
  const issue = (status,code) => new ApiError({status,code,message:'prueba'});
  assert.equal(classifyAlertError(issue(401,'UNAUTHORIZED')).kind,'session');
  assert.equal(classifyAlertError(issue(403,'FORBIDDEN')).kind,'forbidden');
  assert.equal(classifyAlertError(issue(404,'ALERT_NOT_FOUND')).kind,'not_found');
  assert.equal(classifyAlertError(issue(503,'SERVICE_UNAVAILABLE')).kind,'network');
});
test('S4: no duplica POST de marcado y actualiza contadores del filtro OPEN', async () => {
  let markCount = 0; let finish;
  const service = {
    list: async () => [alert()],
    markRead: () => {markCount++; return new Promise(resolve => {finish=resolve;});},
  };
  const controller = createPatientAlerts(service,{now:()=>NOW});
  await controller.setPatient(P1); await controller.setFilter('OPEN');
  const a = controller.markRead(A1);
  const b = controller.markRead(A1);
  assert.equal(markCount,1);
  finish(); await Promise.all([a,b]);
  assert.deepEqual(controller.getState().counts,{all:1,open:0,read:1});
  assert.deepEqual(controller.getState().items,[]);
});
test('S4: cambio de paciente descarta respuesta tardía y detalles previos', async () => {
  const waits=[];
  const service={list: (id) => new Promise(resolve => waits.push({id,resolve})), markRead:async()=>undefined};
  const controller=createPatientAlerts(service);
  const old=controller.setPatient(P1);
  controller.open(A1);
  const current=controller.setPatient(P2);
  assert.equal(controller.selected(),null);
  assert.deepEqual(controller.getState().items,[]);
  waits.find(x=>x.id===P2).resolve([alert(A2)]);
  await current;
  waits.find(x=>x.id===P1).resolve([alert(A1)]);
  await old;
  assert.deepEqual(controller.getState().items.map(x=>x.id),[A2]);
  assert.equal(controller.getState().patientId,P2);
});
test('S4: fallo 403 del servidor nunca presenta alertas clínicas simuladas', async () => {
  const {ApiError}=projectRequire('src/core/infrastructure/http/errors/index.ts');
  const controller=createPatientAlerts({
    list: async () => {throw new ApiError({status:403,code:'FORBIDDEN',message:'sin acceso'});},
    markRead:async()=>undefined,
  });
  await controller.setPatient(P1);
  assert.deepEqual(controller.getState().items,[]);
  assert.equal(controller.getState().error.kind,'forbidden');
});

test('S4: exige campos del contrato actual y rechaza alias y estados históricos', () => {
  for (const overrides of [{id:undefined,alertId:A1}, {readingId:null}, {readingId:undefined}, {readAt:undefined}, {status:'open'}, {readAt:'2026-11-23'}]) {
    invalid([alert(A1,'OPEN',overrides)]);
  }
});
