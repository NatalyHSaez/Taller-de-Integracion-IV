/* global projectRequire, mockModule */
'use strict';
/** S5: notificaciones de usuario, contratos HTTP, paginación, caché y aislamiento. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const calls = { get: [], post: [] };
let getReply;
let postReply;
mockModule('src/core/infrastructure/http/api-client.ts', {
  apiClient: {
    get: async (path, options) => { calls.get.push({path, options}); return getReply; },
    post: async (path, body) => { calls.post.push({path, body}); return postReply; },
  },
});
const demoState = { user: null, notifications: [] };
mockModule('src/modules/demo/infrastructure/demo-store.ts', {
  demo: {
    user: () => demoState.user,
    snapshot: () => ({notificationPrefs: {mediciones: false, vinculos: false}, relations: [], accounts: []}),
    measurements: () => [],
  },
});
mockModule('src/modules/demo/infrastructure/mocks/api-mock.ts', {
  mockApi: {notifications: {list: async () => demoState.notifications}},
});
const {toAppNotification, checkNotificationPage, backendNotificationsApi} =
  projectRequire('src/modules/notifications/infrastructure/notifications-api.ts');
const {createNotificationsStore, classifyNotificationError} =
  projectRequire('src/modules/notifications/application/notifications.ts');
const {demoNotificationsApi, setDemoNotificationSession} =
  projectRequire('src/modules/notifications/infrastructure/notifications-demo.ts');
const {ApiError} = projectRequire('src/core/infrastructure/http/errors/index.ts');
const NOW = '2026-11-23T18:00:00.000Z';
const issued = (status,code) => new ApiError({status,code,message:'Prueba controlada'});
const notification = (id='n1', status='pending', overrides={}) => ({
  id, type:'WELCOME', title:`Aviso ${id}`, body:`Mensaje de ${id}`, status,
  createdAt:NOW, readAt:status==='read'?NOW:null, ...overrides,
});
const page = (items=[], p=1, size=20, total=items.length) => ({items,total,page:p,size});
function invalid(raw, p=1, size=20, status) {
  assert.throws(() => checkNotificationPage(raw,p,size,status), e => e.code === 'INVALID_API_RESPONSE');
}

test('S5: adapta contrato camelCase y mock histórico sin perder fechas ni estado', () => {
  assert.deepEqual(toAppNotification(notification()),notification());
  const old = {id:'n2', tipo:'WELCOME',titulo:'Aviso n2',cuerpo:'Mensaje de n2',
    estado:'read',creada_en:NOW,leida_en:NOW};
  const converted = toAppNotification(old);
  assert.deepEqual(converted, notification('n2','read'));
  assert.equal(toAppNotification(notification('n3','pending',{readAt:null})).readAt,null);
});

test('S5: rechaza estados y campos incompletos, sin reemplazarlos por datos inventados', () => {
  for(const value of [null,{},notification('', 'pending'),notification('n1','OPEN'),
    notification('n1','pending',{title:''}),notification('n1','pending',{body:null}),
    notification('n1','pending',{type:''}),notification('n1','pending',{createdAt:'ayer'}),
    notification('n1','read',{readAt:'sin fecha'})]) {
    assert.equal(toAppNotification(value),null);
  }
});

test('S5: respuesta vacía real incluye metadatos; objetos parciales no son éxito', () => {
  assert.deepEqual(checkNotificationPage(page(),1,20),page());
  for(const response of [null,[],{items:[]}, {total:0,page:1,size:20},
    page([],1,20,-1),page([],2,20,0),page([],1,0,0),page([notification()],1,20,0)]) invalid(response);
});

test('S5: rechaza duplicados, exceso de página y filtro inconsistente', () => {
  invalid(page([notification(),notification()]));
  invalid(page([notification(),notification('n2')],1,1,2),1,1);
  invalid(page([notification()],1,20,1),1,20,'read');
  assert.equal(checkNotificationPage(page([notification('n2','read')]),1,20,'read').items.length,1);
});

test('S5: GET pasa página, tamaño y estado al Gateway; Todas no añade filtro', async () => {
  calls.get.length=0;
  getReply=page([notification()],2,5,3);
  const result=await backendNotificationsApi.list({page:2,size:5});
  assert.equal(result.items[0].id,'n1');
  assert.deepEqual(calls.get[0],{path:'/notifications',options:{query:{page:2,size:5,status:undefined}}});
  getReply=page([notification('n2','read')],1,5,1);
  await backendNotificationsApi.list({page:1,size:5,status:'read'});
  assert.equal(calls.get[1].options.query.status,'read');
});

test('S5: un GET con cuerpo inválido propaga error y nunca se transforma en lista vacía', async () => {
  getReply={items:[]};
  await assert.rejects(backendNotificationsApi.list({page:1,size:20}), e => e.code==='INVALID_API_RESPONSE');
});

test('S5: POST read codifica identificador, sin cuerpo y sin pedir GET individual', async () => {
  calls.post.length=0; calls.get.length=0;
  postReply=undefined;
  await backendNotificationsApi.markRead('identificador con espacios');
  assert.deepEqual(calls.post,[{path:'/notifications/identificador%20con%20espacios/read',body:undefined}]);
  assert.equal(calls.get.length,0);
});

test('S5: diferencia sesión caducada, permiso, inexistencia y caída de red', () => {
  assert.equal(classifyNotificationError(issued(401,'AUTHENTICATION_REQUIRED')).kind,'session');
  assert.equal(classifyNotificationError(issued(403,'FORBIDDEN')).kind,'forbidden');
  assert.equal(classifyNotificationError(issued(404,'NOTIFICATION_NOT_FOUND')).kind,'not_found');
  assert.equal(classifyNotificationError(new TypeError('Failed to fetch')).kind,'network');
});

test('S5: el detalle usa caché; cambiar de usuario elimina los datos anteriores', async () => {
  let count=0;
  const backend={list:async({page:requested,size})=>{count++;return page([notification('u1')],requested,size);},markRead:async()=>{}};
  const store=createNotificationsStore();
  await store.setOwner('u1',backend);
  assert.equal(store.get('u1').title,'Aviso u1');
  assert.equal(store.get('desconocida'),null);
  assert.equal(count,1);
  await store.setOwner('u2',{list:async({page:requested,size})=>page([],requested,size,0),markRead:async()=>{}});
  assert.equal(store.get('u1'),null);
  assert.deepEqual(store.getState().items,[]);
});

test('S5: el mismo usuario con nueva sesión no hereda notificaciones anteriores', async () => {
  const backend={list:async({page:requested,size})=>page([notification('old')],requested,size),markRead:async()=>{}};
  const store=createNotificationsStore();
  await store.setOwner('u1',backend,1);
  await store.setOwner('u1',{list:async({page:requested,size})=>page([],requested,size,0),markRead:async()=>{}},2);
  assert.equal(store.get('old'),null);
  assert.deepEqual(store.getState().items,[]);
});

test('S5: un GET de la sesión anterior no publica datos al llegar tarde', async () => {
  let complete;
  const pending={list:()=>new Promise(resolve=>{complete=resolve;}),markRead:async()=>{}};
  const store=createNotificationsStore();
  const old=store.setOwner('u1',pending,1);
  await store.setOwner('u2',{list:async({page:requested,size})=>page([notification('new')],requested,size),markRead:async()=>{}},2);
  complete(page([notification('old')],1,20));
  await old;
  assert.deepEqual(store.getState().items.map(n=>n.id),['new']);
  assert.equal(store.get('old'),null);
});

test('S5: marcar no envía dos POST y actualiza lista y detalle sin inventar readAt', async () => {
  let finish;let marks=0;
  const backend={list:async({page:requested,size})=>page([notification()],requested,size),
    markRead:()=>{marks++;return new Promise(resolve=>{finish=resolve;});}};
  const store=createNotificationsStore();
  await store.setOwner('u1',backend);
  const a=store.markRead('n1');const b=store.markRead('n1');
  assert.equal(marks,1);finish();await Promise.all([a,b]);
  assert.equal(store.get('n1').status,'read');
  assert.equal(store.get('n1').readAt,null,'la fecha real la devuelve el backend');
  await store.markRead('n1');assert.equal(marks,1);
});

test('S5: marcar dentro de Enviadas no salta elementos al cargar más páginas', async () => {
  const db=Array.from({length:5},(_,i)=>notification(`n${i+1}`,'sent'));
  const backend={
    list:async({page:requested,size,status})=>{
      const filtered=db.filter(n=>!status || n.status===status);
      return page(filtered.slice((requested-1)*size,requested*size),requested,size,filtered.length);
    },
    markRead:async id=>{db.find(n=>n.id===id).status='read';},
  };
  const store=createNotificationsStore({pageSize:2});
  await store.setOwner('u1',backend);await store.setFilter('sent');
  await store.markRead('n1');await store.loadMore();await store.loadMore();
  assert.deepEqual(store.getState().items.map(n=>n.id),['n2','n3','n4','n5']);
});

test('S5: un 403 no muestra mocks; un 404 al marcar elimina el elemento obsoleto', async () => {
  const store=createNotificationsStore();
  await store.setOwner('u1',{
    list:async()=>{throw issued(403,'FORBIDDEN');},markRead:async()=>{},
  });
  assert.equal(store.getState().error.kind,'forbidden');
  assert.deepEqual(store.getState().items,[]);
  const backend={list:async({page:requested,size})=>page([notification('missing')],requested,size),
    markRead:async()=>{throw issued(404,'NOTIFICATION_NOT_FOUND');}};
  await store.setOwner('u1',backend,2);
  await store.markRead('missing');
  assert.equal(store.getState().markError.kind,'not_found');
  assert.equal(store.get('missing'),null);
});

test('S5: modo demo no consulta el Gateway y reinicia marcas tras cerrar sesión', async () => {
  calls.get.length=0;calls.post.length=0;
  demoState.user={id:'demo-user',role:'patient'};
  demoState.notifications=[notification('mock-1')];
  setDemoNotificationSession(101,true);
  const first=await demoNotificationsApi.list({page:1,size:1});
  assert.equal(first.items.length,1);
  await demoNotificationsApi.markRead('mock-1');
  assert.equal((await demoNotificationsApi.list({page:1,size:1,status:'read'})).items[0].status,'read');
  setDemoNotificationSession(102,false);
  demoState.user=null;
  assert.equal((await demoNotificationsApi.list({page:1,size:20})).total,0);
  demoState.user={id:'demo-user',role:'patient'};
  setDemoNotificationSession(103,true);
  assert.equal((await demoNotificationsApi.list({page:1,size:1})).items[0].status,'pending');
  assert.equal(calls.get.length,0);assert.equal(calls.post.length,0);
  setDemoNotificationSession(104,false);
  demoState.user=null;
});

test('S5: pantalla usa paginación y caché; no se inventa GET de detalle ni push', () => {
  const root=path.resolve(__dirname,'..');
  const list=fs.readFileSync(path.join(root,'app/notificaciones.tsx'),'utf8');
  const detail=fs.readFileSync(path.join(root,'app/notificacion/[id].tsx'),'utf8');
  const view=fs.readFileSync(path.join(root,'src/modules/notifications/presentation/components/notifications-view.tsx'),'utf8');
  assert.match(list,/loadMore|Cargar más/);
  assert.match(list,/useNotifications/);
  assert.match(detail,/store\.get\(id\)/);
  assert.match(detail,/store\.markRead\(/);
  assert.doesNotMatch(detail,/apiClient\.get\s*\(/);
  assert.match(view,/INTERNAL_NOTICE/);
  assert.doesNotMatch(list,/['"`]\/notificaciones['"`]/);
});
