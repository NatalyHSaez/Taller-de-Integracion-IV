/* global projectRequire, __dirname */
/** Inicio con datos reales: mediciones, alerta prioritaria, permiso de registro, errores y cambio de paciente. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakes, apiError } = require('./support/fakes.cjs');

installFakes();
const { createHomeSummary, pickPriorityAlert, classifyHomeError } = projectRequire('services/home-summary.ts');

const bp = (id, day, systolic) => ({ id, readingId: id, type: 'blood_pressure', measuredAt: `2026-11-0${day}T10:00:00.000Z`, systolic, diastolic: 80, heartRate: 70 });
const alert = (id, severity, createdAt, status = 'OPEN') => ({ id, readingId: null, ruleCode: 'R', severity, explanation: `Alerta ${id}`, status, createdAt, readAt: null });

function deps(overrides = {}) {
  const calls = [];
  return {
    calls,
    measurements: async (id) => { calls.push(['measurements', id]); return [bp(`${id}-r1`, 5, 130)]; },
    openAlerts: async (id) => { calls.push(['alerts', id]); return [alert('a1', 'MEDIA', '2026-11-05T10:00:00Z')]; },
    caregiverPermissions: async (id) => { calls.push(['permissions', id]); return ['MEASUREMENT_VIEW']; },
    ...overrides,
  };
}

test('paciente: carga mediciones y alerta reales y puede registrar', async () => {
  const d = deps();
  const store = createHomeSummary(d);
  const loading = store.setPatient('pia', 'patient');
  assert.equal(store.getState().loading, true);
  await loading;
  const state = store.getState();
  assert.equal(state.measurements[0].systolic, 130);
  assert.equal(state.alert.id, 'a1');
  assert.equal(state.canRegister, true);
  assert.ok(!d.calls.some((c) => c[0] === 'permissions'), 'el paciente no necesita permisos');
});

test('cuidador: registrar solo con MEASUREMENT_CREATE', async () => {
  const sin = createHomeSummary(deps());
  await sin.setPatient('pia', 'caregiver');
  assert.equal(sin.getState().canRegister, false);

  const con = createHomeSummary(deps({ caregiverPermissions: async () => ['MEASUREMENT_VIEW', 'MEASUREMENT_CREATE'] }));
  await con.setPatient('pia', 'caregiver');
  assert.equal(con.getState().canRegister, true);
});

test('si fallan las alertas, igual se muestran las mediciones', async () => {
  const store = createHomeSummary(deps({ openAlerts: () => Promise.reject(apiError('FORBIDDEN', 403)) }));
  await store.setPatient('pia', 'caregiver');
  assert.equal(store.getState().measurements.length, 1);
  assert.equal(store.getState().alert, null);
  assert.equal(store.getState().error, null);
});

test('403 en mediciones: sin acceso; red: reintento que recupera', async () => {
  const forbidden = createHomeSummary(deps({ measurements: () => Promise.reject(apiError('FORBIDDEN', 403)) }));
  await forbidden.setPatient('pia', 'caregiver');
  assert.equal(forbidden.getState().error.kind, 'forbidden');
  assert.deepEqual(forbidden.getState().measurements, []);

  let fail = true;
  const d = deps();
  const flaky = createHomeSummary({ ...d, measurements: (id) => (fail ? Promise.reject(new TypeError('Network request failed')) : d.measurements(id)) });
  await flaky.setPatient('pia', 'patient');
  assert.equal(flaky.getState().error.kind, 'network');
  assert.equal(flaky.getState().loaded, false);
  fail = false;
  await flaky.refresh();
  assert.equal(flaky.getState().error, null);
  assert.equal(flaky.getState().measurements.length, 1);
});

test('al volver a Inicio se actualiza (aparece la medición recién registrada)', async () => {
  const rows = [bp('r1', 4, 120)];
  const store = createHomeSummary(deps({ measurements: async () => [...rows] }));
  await store.setPatient('pia', 'patient');
  rows.push(bp('r2', 6, 140));
  await store.refresh();
  assert.equal(store.getState().measurements.length, 2);
});

test('cambiar de paciente descarta lo anterior y las respuestas tardías', async () => {
  const pending = {};
  const store = createHomeSummary(deps({
    measurements: (id) => new Promise((resolve) => { pending[id] = resolve; }),
  }));
  const first = store.setPatient('pia', 'caregiver');
  const second = store.setPatient('rosa', 'caregiver');
  assert.deepEqual(store.getState().measurements, []);
  pending.rosa([bp('rosa-r1', 5, 110)]);
  await second;
  pending.pia([bp('pia-r1', 5, 150)]);
  await first;
  assert.equal(store.getState().patientId, 'rosa');
  assert.equal(store.getState().measurements[0].id, 'rosa-r1');

  await store.setPatient(null);
  assert.deepEqual(store.getState().measurements, []);
});

test('alerta prioritaria: abierta, de severidad alta primero y más reciente', () => {
  const picked = pickPriorityAlert([
    alert('vieja-alta', 'ALTA', '2026-11-01T00:00:00Z'),
    alert('nueva-media', 'MEDIA', '2026-11-06T00:00:00Z'),
    alert('leida-alta', 'ALTA', '2026-11-06T00:00:00Z', 'READ'),
    alert('nueva-alta', 'ALTA', '2026-11-05T00:00:00Z'),
  ]);
  assert.equal(picked.id, 'nueva-alta');
  assert.equal(pickPriorityAlert([]), null);
  assert.equal(classifyHomeError(apiError('X', 401)).kind, 'session');
});

test('Inicio ya no dice "cuando se conecte esta función al backend"', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
  assert.doesNotMatch(source, /cuando se conecte esta función al backend/);
  assert.match(source, /createHomeSummary\(\)/);
  assert.match(source, /homeStore\.refresh\(\)/);
});
