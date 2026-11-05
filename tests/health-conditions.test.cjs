/* global projectRequire */
/** Catálogo de programas con la respuesta real de GET /health-conditions. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakes } = require('./support/fakes.cjs');

const fakes = installFakes();
const { healthConditionsService } = projectRequire('services/health-conditions.ts');

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
