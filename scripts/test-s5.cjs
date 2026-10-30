// TI4-78 / S5: notificaciones y estado del módulo de consultas; HTTP simulado.
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
    mod.exports = { IS_API_CONFIGURED: true, API_V1_URL: 'http://s5.test/api/v1' }; return;
  }
  if (file === path.join(root, 'services/token-storage.ts')) {
    mod.exports = { getAccessToken: async()=>null, getRefreshToken:async()=>null,
      saveTokens:async()=>{}, clearTokens:async()=>{} }; return;
  }
  const output = ts.transpileModule(fs.readFileSync(file,'utf8'), {
    fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  });
  mod._compile(output.outputText,file);
};
global.__DEV__ = false;
const { authSession } = require('../services/auth-session');
const { dataClient } = require('../services/data');
const { demo } = require('../services/demo-store');
const { getNotifications, getNotificationById, markNotificationRead, notificationsService,
  checkNotificationPage, getDemoNotifications } = require('../services/notifications');
const first='dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const second='dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
const other='dddddddd-dddd-4ddd-8ddd-ddddddddddd3';
const oneUser='25b78bc3-8a8d-48d0-8a7c-c9346beae2ed';
const otherUser='25b78bc3-8a8d-48d0-8a7c-c9346beae2ee';
const tokens={accessToken:'test',refreshToken:'test-refresh',tokenType:'bearer',expiresIn:3600};
const user = id=>({id,fullName:'Paciente',email:id+'@s5.test',roles:['PATIENT']});
const notification=(id=first,status='pending')=>({id,type:'WELCOME',title:'Bienvenido a Domicilia',
  body:'Cuenta activa.',status,readAt:status==='read'?'2026-10-29T15:00:00Z':null,
  createdAt:'2026-10-29T14:00:00Z'});
const payload=(items=[],page=1,size=20,total=items.length)=>({total,page,size,items});
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const empty=()=>new Response(null,{status:204});
const issue=(status,code)=>json({detail:'Error controlado',errorCode:code},status);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
let tests=0,calls=0;
async function check(label, action) {
  authSession.clear();demo.logout();dataClient.clearCache();calls=0;
  global.fetch=async(url)=>{throw Error('Solicitud inesperada '+url);};
  try {await action();console.log('OK',label);tests++;}
  catch(e){console.error('FALLÓ:',label);throw e;}
}
function backend(id=oneUser){authSession.startBackend(tokens,user(id));}
function mock(){demo.login('paciente@ejemplo.com','Paciente123');authSession.startMock(tokens,user(demo.user().id));}
function mockFetch(body){global.fetch=async()=>{calls++;return json(body);};}
async function main(){
  await check('Sin sesión impide listado, detalle y marcado',async()=>{
    await assert.rejects(notificationsService.list(),e=>e.status===401);
    await assert.rejects(notificationsService.detail(first),e=>e.status===401);
    await assert.rejects(notificationsService.markRead(first),e=>e.status===401);
  });
  await check('Sesión backend sin usuario no consulta notificaciones',async()=>{
    authSession.startBackend(tokens,null);
    await assert.rejects(notificationsService.list(),e=>e.code==='AUTHENTICATION_REQUIRED');
  });
  await check('Página, tamaño y filtro inválidos se rechazan antes de fetch',async()=>{
    backend();for(const arg of [{page:0},{page:1.5},{size:0},{size:101},{status:'OPEN'}]){
      await assert.rejects(notificationsService.list(arg),e=>e.status===422);
    }
  });
  await check('GET autenticado usa ruta, page=1, size=20 sin filtro para Todas',async()=>{
    backend();let seen='';global.fetch=async(url,init)=>{
      calls++;seen=String(url);assert.match(init.headers.get('Authorization'),/^Bearer /);
      return json(payload([notification()]));};
    const result=await notificationsService.list();assert.equal(result.items.length,1);
    assert.match(seen,/\/notifications\?page=1&size=20$/);assert.equal(calls,1);
  });
  await check('Estados pending, sent y read viajan al Gateway',async()=>{
    backend();const queries=[];
    global.fetch=async url=>{queries.push(String(url));
      const status=new URL(String(url)).searchParams.get('status');return json(payload([notification(first,status)]));};
    for(const status of ['pending','sent','read']){
      assert.equal((await notificationsService.list({status})).items[0].status,status);
    }
    assert.equal(queries.length,3);assert.ok(queries[2].endsWith('status=read'));
  });
  await check('Paginación mantiene page/size/total sin descargar todo de golpe',async()=>{
    backend();const urls=[];global.fetch=async url=>{
      urls.push(String(url));const page=Number(new URL(String(url)).searchParams.get('page'));
      return json(payload([notification(page===1?first:second)],page,1,2));};
    const p1=await notificationsService.list({page:1,size:1});
    const p2=await notificationsService.list({page:2,size:1});
    assert.equal(p1.items[0].id,first);assert.equal(p2.items[0].id,second);assert.equal(p2.total,2);
    assert.equal(urls.length,2);
  });
  await check('El listado [] con total 0 es vacío real',async()=>{
    backend();mockFetch(payload());const page=await notificationsService.list();
    assert.deepEqual(page.items,[]);assert.equal(page.total,0);
  });
  await check('Rechaza un objeto sin metadatos, no lo considera lista vacía',async()=>{
    backend();mockFetch({items:[]});
    await assert.rejects(notificationsService.list(),e=>e.code==='INVALID_API_RESPONSE');
  });
  await check('Rechaza metadatos de paginación incorrectos',async()=>{
    backend();for(const item of [payload([],2),payload([],1,10),payload([],1,20,-1),
      payload([notification(),notification(second)],1,1,2)]){
      assert.throws(()=>checkNotificationPage(item,1,20,'all'),e=>e.code==='INVALID_API_RESPONSE');
    }
  });
  await check('Rechaza IDs duplicados o inválidos y campos faltantes',async()=>{
    for(const items of [[notification(),notification()],[{...notification(),id:'bad'}],
      [{...notification(),title:''}],[{...notification(),body:null}]]) {
      assert.throws(()=>checkNotificationPage(payload(items),1,20,'all'),e=>e.code==='INVALID_API_RESPONSE');
    }
  });
  await check('Rechaza estados, fechas inválidas y resultados que no cumplen filtro',async()=>{
    for(const entry of [{...notification(),status:'OPEN'},
      {...notification(),createdAt:'ayer'},{...notification(),readAt:'invalid'}]) {
      assert.throws(()=>checkNotificationPage(payload([entry]),1,20,'all'));
    }
    assert.throws(()=>checkNotificationPage(payload([notification()]),1,20,'read'));
  });
  await check('ReadAt y valores opcionales nulos se preservan',async()=>{
    backend();mockFetch(payload([notification()]));const item=(await notificationsService.list()).items[0];
    assert.equal(item.readAt,null);assert.equal(item.leida,false);
  });
  await check('Cada página y filtro conserva caché separada',async()=>{
    backend();global.fetch=async url=>{calls++;
      const params=new URL(String(url)).searchParams;
      return json(payload([],Number(params.get('page')),Number(params.get('size'))));};
    await notificationsService.list({page:1,status:'read'});await notificationsService.list({page:1,status:'read'});
    await notificationsService.list({page:2,status:'read'});await notificationsService.list({page:1,status:'pending'});
    assert.equal(calls,3);
  });
  await check('Actualización forzada evita la caché',async()=>{
    backend();global.fetch=async()=>{calls++;return json(payload([notification(calls===1?first:second)]));};
    await notificationsService.list();assert.equal((await notificationsService.list({forceRefresh:true})).items[0].id,second);
    assert.equal(calls,2);
  });
  await check('Respuesta inválida no permanece en caché',async()=>{
    backend();global.fetch=async()=>{calls++;return json(calls===1?{items:[]}:payload([notification()]));};
    await assert.rejects(notificationsService.list());
    assert.equal((await notificationsService.list()).items.length,1);assert.equal(calls,2);
  });
  await check('Detalle desde lista usa caché y nunca GET individual',async()=>{
    backend();mockFetch(payload([notification()]));await notificationsService.list();
    const result=await notificationsService.detail(first);
    assert.equal(result.id,first);assert.equal(calls,1);
  });
  await check('Enlace directo intenta primer listado, no ruta GET individual',async()=>{
    backend();mockFetch(payload([notification()]));
    const result=await notificationsService.detail(first);
    assert.equal(result.id,first);assert.equal(calls,1);
  });
  await check('ID directo ausente informa no encontrado, no inventa detalle',async()=>{
    backend();mockFetch(payload([notification()]));
    assert.equal(await notificationsService.detail(other),undefined);
  });
  await check('GET detalle backend rechaza ID inválido antes de fetch',async()=>{
    backend();await assert.rejects(notificationsService.detail('missing'),e=>e.code==='INVALID_NOTIFICATION_ID');
  });
  await check('POST read no envía body y acepta HTTP 204',async()=>{
    backend();let url='';global.fetch=async(u,init)=>{calls++;url=String(u);
      assert.equal(init.method,'POST');assert.equal(init.body,undefined);return empty();};
    await notificationsService.markRead(first);assert.ok(url.endsWith('/notifications/'+first+'/read'));
    assert.equal(calls,1);
  });
  await check('POST rechaza ID inválido antes de consultar servidor',async()=>{
    backend();await assert.rejects(notificationsService.markRead('1'),e=>e.code==='INVALID_NOTIFICATION_ID');
  });
  await check('POST read invalida todas las páginas y estados',async()=>{
    backend();let marked=false;
    global.fetch=async(u,init)=>{calls++;
      if(init.method==='POST'){marked=true;return empty();}
      const q=new URL(String(u)).searchParams;
      const filtered=q.get('status');const items=filtered==='read'? (marked?[notification(first,'read')]:[]) :
        filtered==='pending'? (marked?[]:[notification()]):[];
      return json(payload(items,Number(q.get('page')),Number(q.get('size'))));};
    await notificationsService.list({status:'pending',page:1});
    await notificationsService.list({status:'read',page:1});
    await notificationsService.list({status:'pending',page:2});
    await notificationsService.markRead(first);
    assert.equal((await notificationsService.list({status:'pending'})).items.length,0);
    assert.equal((await notificationsService.list({status:'read'})).items[0].status,'read');
    assert.equal(calls,6);
  });
  await check('Error POST no inventa éxito ni actualiza detalle',async()=>{
    backend();global.fetch=async(u,init)=>init.method==='POST'?issue(500,'INTERNAL_ERROR'):json(payload([notification()]));
    await notificationsService.list();
    await assert.rejects(notificationsService.markRead(first),e=>e.status===500);
    assert.equal((await notificationsService.detail(first)).leida,false);
  });
  await check('404 NOTIFICATION_NOT_FOUND se propaga, no marca localmente',async()=>{
    backend();global.fetch=async()=>issue(404,'NOTIFICATION_NOT_FOUND');
    await assert.rejects(notificationsService.markRead(first),e=>e.status===404);
  });
  await check('403 del listado y marcado no consulta mocks',async()=>{
    backend();global.fetch=async()=>issue(403,'FORBIDDEN');
    await assert.rejects(notificationsService.list(),e=>e.status===403);
    await assert.rejects(notificationsService.markRead(first),e=>e.status===403);
    assert.deepEqual(getDemoNotifications(),[]);
  });
  await check('500/503 del servidor permanece visible',async()=>{
    backend();global.fetch=async()=>issue(503,'AUTHORIZATION_UNAVAILABLE');
    await assert.rejects(notificationsService.list(),e=>e.status===503);
  });
  await check('Logout durante GET impide resultados tardíos',async()=>{
    backend();let finish;global.fetch=()=>new Promise(resolve=>{finish=resolve;});
    const request=notificationsService.list();await tick();
    authSession.clear();dataClient.clearCache();finish(json(payload([notification()])));
    await assert.rejects(request,e=>e.code==='SESSION_CHANGED');
  });
  await check('Logout durante POST impide actualizar otra sesión',async()=>{
    backend();let finish;global.fetch=()=>new Promise(resolve=>{finish=resolve;});
    const request=notificationsService.markRead(first);await tick();
    authSession.clear();dataClient.clearCache();finish(empty());
    await assert.rejects(request,e=>e.code==='SESSION_CHANGED');
  });
  await check('El usuario B no recupera el detalle almacenado por el usuario A',async()=>{
    backend(oneUser);mockFetch(payload([notification()]));await notificationsService.list();
    backend(otherUser);mockFetch(payload([]));
    assert.equal(await notificationsService.detail(first),undefined);
  });
  await check('Modo demo funciona sin hacer fetch y mantiene paginación',async()=>{
    mock();const result=await notificationsService.list({page:1,size:1});
    assert.equal(result.items.length,1);assert.ok(result.total>=1);
  });
  await check('Modo demo filtra pendientes y leídas sin tocar el Gateway',async()=>{
    mock();const item=(await notificationsService.list()).items[0];
    await notificationsService.markRead(item.id);
    const read=await notificationsService.list({status:'read'});
    assert.ok(read.items.some(x=>x.id===item.id));
  });
  await check('Modo demo marca localmente solo una notificación existente',async()=>{
    mock();const item=(await getNotifications())[0];
    await markNotificationRead(item.id);
    assert.equal((await getNotificationById(item.id)).leida,true);
    await assert.rejects(markNotificationRead('other-user-id'),e=>e.status===404);
  });
  await check('Nuevo login demo no hereda marcas del usuario previo',async()=>{
    mock();const item=(await notificationsService.list()).items[0];
    await notificationsService.markRead(item.id);
    authSession.clear();demo.logout();mock();
    const list=await notificationsService.list();
    assert.equal(list.items.find(x=>x.id===item.id)?.leida,false);
  });
  await check('Legacy getNotifications conserva arreglo para pantallas previas',async()=>{
    backend();mockFetch(payload([notification()],1,100));
    const list=await getNotifications();assert.equal(list.length,1);assert.equal(list[0].leida,false);
  });
  await check('Pantallas usan paginación, marcado explícito y detalle sin GET por ID',async()=>{
    const list=fs.readFileSync(path.join(root,'app/notificaciones.tsx'),'utf8');
    const detail=fs.readFileSync(path.join(root,'app/notificacion/[id].tsx'),'utf8');
    assert.match(list,/Cargar más/);assert.match(list,/Pendientes/);assert.match(list,/Enviadas/);assert.match(list,/Leídas/);
    assert.match(list,/notificationsService\.markRead/);assert.match(detail,/notificationsService\.detail/);
    assert.match(detail,/Marcar como leída/);assert.doesNotMatch(detail,/GET \/notifications\/\$\{/);
  });
  await check('Módulo consultas comunica ausencia de API sin endpoints ficticios',async()=>{
    const screen=fs.readFileSync(path.join(root,'app/(tabs)/atencion.tsx'),'utf8');
    assert.match(screen,/en desarrollo/);assert.match(screen,/Integra II/);
    assert.doesNotMatch(screen,/fetch\(|apiClient\.|consultations\//);
  });
  console.log(`\n${tests} comprobaciones S5 correctas (HTTP simulado).`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
