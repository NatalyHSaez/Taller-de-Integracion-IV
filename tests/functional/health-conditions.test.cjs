/* global projectRequire */
/** Catálogo de programas con la respuesta real de GET /health-conditions. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakes } = require('../support/fakes.cjs');

const fakes = installFakes();
projectRequire('src/modules/monitoring/application/ports/monitoring-port.ts').configureMonitoring({
  ...projectRequire('src/modules/monitoring/infrastructure/api/monitoring-api.ts').monitoringApi,
  listCaregivers: async () => { throw new Error('Unexpected caregivers request'); },
  listDoctors: async () => { throw new Error('Unexpected doctors request'); },
});
const { healthConditionsService } = projectRequire('src/modules/monitoring/application/use-cases/health-conditions.ts');

test('lee programas sin conditionId ni active, con parámetros obligatorios y opcionales', async () => {
  const programs = await healthConditionsService.list({ forceRefresh: true });
  assert.deepEqual(programs.map((p) => [p.id, p.code, p.name]), [
    ['DM2', 'DM2', 'Diabetes mellitus tipo 2'],
    ['HTA', 'HTA', 'Hipertensión arterial'],
  ]);
  assert.deepEqual(programs[1].parameters, [
    { code: 'SBP', required: true },
    { code: 'DBP', required: true },
    { code: 'HEART_RATE', required: false },
  ]);
});

test('solo consulta /health-conditions, nunca condiciones asignadas del paciente', async () => {
  await healthConditionsService.list({ forceRefresh: true });
  assert.ok(fakes.calls.dataGet.every((path) => path === '/health-conditions'));
  assert.equal(fakes.calls.get.length, 0);
});
