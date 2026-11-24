const test = require('node:test');
const assert = require('node:assert/strict');
const { createHomeSummary } = projectRequire('src/modules/dashboard/application/home-summary.ts');
const { configureHomeSummary } = projectRequire('src/modules/dashboard/application/home-summary-port.ts');
const { ApiError } = projectRequire('src/core/infrastructure/http/errors/index.ts');

test('dashboard sin composición no usa un adaptador implícito', () => {
  assert.throws(() => createHomeSummary(), /no está configurado/);
});

test('dashboard usa las dependencias inyectadas y limpia datos tras revocar acceso', async () => {
  const calls = [];
  let forbidden = false;
  configureHomeSummary({
    measurements: async id => {
      calls.push(['measurements', id]);
      if (forbidden) throw new ApiError({ code: 'FORBIDDEN', status: 403, message: 'Sin acceso' });
      return [{ id: 'r1' }];
    },
    openAlerts: async id => { calls.push(['alerts', id]); return []; },
    caregiverPermissions: async id => { calls.push(['permissions', id]); return ['MEASUREMENT_CREATE']; },
  });
  const store = createHomeSummary();
  await store.setPatient('p1', 'caregiver');
  assert.equal(store.getState().measurements.length, 1);
  assert.equal(store.getState().canRegister, true);
  assert.deepEqual(calls.map(c => c[1]), ['p1', 'p1', 'p1']);
  forbidden = true;
  await store.refresh();
  assert.deepEqual(store.getState().measurements, []);
  assert.equal(store.getState().alert, null);
  assert.equal(store.getState().canRegister, false);
  assert.equal(store.getState().error.kind, 'forbidden');
});
