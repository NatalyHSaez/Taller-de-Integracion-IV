const test = require('node:test');
const assert = require('node:assert/strict');
const {createNotificationsStore} = projectRequire('src/modules/notifications/application/use-cases/notifications.ts');
const notification = (id, status) => ({id, status, title:'Test', body:'Test', type:'TEST', createdAt:'2026-01-01T00:00:00Z', readAt:null});
test('unread: una búsqueda extensa termina por bloques y permite continuar desde una lista vacía', async () => {
  const calls = [];
  const store = createNotificationsStore({pageSize:1});
  await store.setOwner('u', {list: async ({page,size}) => {
    calls.push(page);
    return {page,size,total:5,items:[notification(String(page),page===5?'sent':'read')]};
  },markRead:async()=>{}});
  assert.deepEqual(calls,[1,2,3]);
  assert.equal(store.getState().loading,false);
  assert.equal(store.getState().loaded,true);
  assert.equal(store.getState().hasMore,true);
  assert.deepEqual(store.getState().items,[]);
  await store.loadMore();
  assert.deepEqual(calls,[1,2,3,4,5]);
  assert.equal(store.getState().items[0].id,'5');
  assert.equal(store.getState().hasMore,false);
});
test('unread: al cambiar sesión una página tardía no continúa consultando', async () => {
  let resolve;
  let oldCalls=0;
  const store=createNotificationsStore({pageSize:1});
  const old=store.setOwner('old',{list:()=>{oldCalls++;return new Promise(r=>{resolve=r;});},markRead:async()=>{}});
  await store.setOwner('new',{list:async({page,size})=>({page,size,total:0,items:[]}),markRead:async()=>{}});
  resolve({page:1,size:1,total:100,items:[notification('old','read')]});
  await old;
  assert.equal(oldCalls,1);
  assert.equal(store.getState().ownerId,'new');
  assert.equal(store.getState().loading,false);
});
