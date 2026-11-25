/* global projectRequire */
const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakes } = require('../support/fakes.cjs');
installFakes();
const { configureMonitoring, monitoringRepository } = projectRequire('src/modules/monitoring/application/ports/monitoring-port.ts');
const { healthConditionsService } = projectRequire('src/modules/monitoring/application/use-cases/health-conditions.ts');
const { createLinkedPeopleLoader } = projectRequire('src/modules/monitoring/application/use-cases/recorded-by.ts');
test('seguimiento sin composición no consulta un adaptador implícito', async () => {
  assert.throws(() => monitoringRepository(), /no está configurado/);
  await assert.rejects(healthConditionsService.list(), /no está configurado/);
});
test('catálogo y nombres usan el repositorio inyectado', async () => {
  const calls = [];
  configureMonitoring({
    async listHealthConditions(forceRefresh) { calls.push(forceRefresh); return [{code:'HTA',name:'Hipertensión'}]; },
    async listCaregivers(id) { calls.push(id); return [{userId:'c',fullName:'Cuidador'}]; },
    async listDoctors(id) { calls.push(id); return []; },
  });
  assert.equal((await healthConditionsService.list({forceRefresh:true}))[0].code,'HTA');
  assert.equal((await createLinkedPeopleLoader().load('p')).caregivers[0].userId,'c');
  assert.deepEqual(calls,[true,'p','p']);
});
