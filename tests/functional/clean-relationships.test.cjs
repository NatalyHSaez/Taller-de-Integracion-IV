/* global projectRequire */
const test = require('node:test');
const assert = require('node:assert/strict');
const { configureRelationships, relationshipsRepository } = projectRequire('src/modules/relationships/application/ports/relationships-port.ts');
const { createPatientLinkCode } = projectRequire('src/modules/relationships/application/use-cases/link-codes.ts');
const { getPatientCaregivers, getPatientDoctors } = projectRequire('src/modules/relationships/application/use-cases/relationship-actions.ts');

test('relaciones sin composición no consulta un adaptador implícito', async () => {
  assert.throws(() => relationshipsRepository(), /no está configurado/);
  await assert.rejects(createPatientLinkCode('p'), /no está configurado/);
});

test('generación y listados usan el repositorio inyectado', async () => {
  const calls = [];
  configureRelationships({
    async createPatientLinkCode(id, type) { calls.push([id, type]); return { code: 'ABC123' }; },
    async getPatientCaregivers(id) { calls.push(['caregivers', id]); return []; },
    async getPatientDoctors(id) { calls.push(['doctors', id]); return []; },
  });
  assert.equal((await createPatientLinkCode('p', 'DOCTOR')).code, 'ABC123');
  await createPatientLinkCode('p');
  assert.deepEqual(await getPatientCaregivers('p'), []);
  assert.deepEqual(await getPatientDoctors('p'), []);
  assert.deepEqual(calls, [['p', 'DOCTOR'], ['p', 'CAREGIVER'], ['caregivers', 'p'], ['doctors', 'p']]);
});
