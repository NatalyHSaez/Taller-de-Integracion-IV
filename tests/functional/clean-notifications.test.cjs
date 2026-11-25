/* global projectRequire */
const test = require('node:test');
const assert = require('node:assert/strict');
const { configureNotifications } = projectRequire('src/modules/notifications/application/ports/notifications-port.ts');
const { selectNotificationOwner, notificationsStore } = projectRequire('src/modules/notifications/application/use-cases/notifications.ts');

test('notificaciones sin composición no usan un adaptador implícito', () => {
  assert.throws(() => selectNotificationOwner('user', 1), /no está configurado/);
});

test('notificaciones usan el repositorio inyectado y distinguen sesiones de la misma cuenta', async () => {
  const calls = [];
  configureNotifications({
    list: async query => { calls.push(query); return { items: [], total: 0, page: query.page, size: query.size }; },
    markRead: async () => {},
  });
  await selectNotificationOwner('user', 1);
  assert.equal(calls.length, 1);
  assert.equal(notificationsStore.isOwner('user', 1), true);
  assert.equal(notificationsStore.isOwner('user', 2), false);
  await selectNotificationOwner('user', 2);
  assert.equal(calls.length, 2);
  assert.equal(notificationsStore.isOwner('user', 2), true);
  await selectNotificationOwner(null, 3);
  assert.equal(notificationsStore.isOwner('user', 2), false);
  assert.equal(notificationsStore.getState().ownerId, null);
  assert.equal(calls.length, 2);
});
