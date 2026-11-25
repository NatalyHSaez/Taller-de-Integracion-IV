const test = require('node:test');
const assert = require('node:assert/strict');
const { createPatientAlerts } = require('../../src/modules/evaluation/application/use-cases/patient-alerts.ts');
const item = (id, status = 'OPEN') => ({ id, status, readingId: null, ruleCode: 'X', severity: 'ALTA', explanation: 'Prueba', createdAt: '2026-11-01T00:00:00Z', readAt: null });

test('el controlador recibe un repositorio y permite iniciar en OPEN', async () => {
  const calls = [];
  const controller = createPatientAlerts({ list: async (id, status) => { calls.push([id, status]); return [item('a')]; }, markRead: async () => {} }, { initialFilter: 'OPEN' });
  await controller.setPatient('p');
  assert.equal(controller.getState().filter, 'OPEN');
  assert.deepEqual(calls, [['p', undefined], ['p', 'OPEN']]);
});

test('un 403 al refrescar elimina la información clínica anterior', async () => {
  let denied = false;
  const controller = createPatientAlerts({ list: async () => { if (denied) throw { status: 403 }; return [item('a')]; }, markRead: async () => {} });
  await controller.setPatient('p');
  denied = true;
  await controller.refresh();
  assert.deepEqual(controller.getState().items, []);
  assert.equal(controller.getState().error.kind, 'forbidden');
  assert.equal(controller.getState().counts, null);
});

test('una marca tardía no modifica otro paciente con el mismo id de alerta', async () => {
  const pending = [];
  const controller = createPatientAlerts({ list: async () => [item('a')], markRead: () => new Promise(resolve => pending.push(resolve)) });
  await controller.setPatient('p1');
  const first = controller.markRead('a');
  await controller.setPatient('p2');
  const second = controller.markRead('a');
  pending[0](); await first;
  assert.deepEqual(controller.getState().marking, ['a']);
  assert.equal(controller.getState().items[0].status, 'OPEN');
  pending[1](); await second;
  assert.equal(controller.getState().items[0].status, 'READ');
});
