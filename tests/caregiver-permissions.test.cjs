/* global projectRequire, mockModule, __dirname */
/**
 * El cuidador puede registrar mediciones de sus pacientes vinculados:
 * los permisos de la app salen del vínculo real (GET /me/patients), no del modo demo.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let myPatients = [];
mockModule('src/core/infrastructure/http/api-client.ts', {
  setApiAccessTokenProvider() {},
  invalidateApiSession() {},
});
mockModule('src/modules/relationships/infrastructure/relationships-api.ts', {
  getMePatients: async () => myPatients.map((p) => ({ ...p })),
});

const { authSession } = projectRequire('src/core/application/session/auth-session.ts');
const { demo } = projectRequire('src/modules/demo/infrastructure/demo-store.ts');
const { appState, permissionsFromCodes } = projectRequire('src/core/application/session/app-state.ts');

const caregiver = { id: 'cui-1', email: 'cui@x.cl', fullName: 'Cuidadora Ana', roles: ['CAREGIVER'], status: 'active' };
const link = (patientId, permissions) => ({
  patientId, fullName: `Paciente ${patientId}`, relationshipId: `rel-${patientId}`, relationshipType: 'CAREGIVER', permissions, linkedAt: '',
});

async function loginAsCaregiver() {
  authSession.startBackend({ accessToken: 'a', refreshToken: 'r', tokenType: 'bearer', expiresIn: 3600 });
  authSession.setUser(caregiver);
  demo.startBackendSession(caregiver);
  await appState.loadRealPatients();
}

test('códigos del vínculo → permisos de la app', () => {
  assert.deepEqual(permissionsFromCodes(['MEASUREMENT_CREATE', 'MEASUREMENT_VIEW', 'ALERT_VIEW']), { alerts: true, read: true, write: true });
  assert.deepEqual(permissionsFromCodes(['PATIENT_PROFILE_VIEW']), { alerts: false, read: false, write: false });
  assert.deepEqual(permissionsFromCodes(null), { alerts: false, read: false, write: false });
});

test('el cuidador con MEASUREMENT_CREATE puede registrar para el paciente seleccionado', async () => {
  myPatients = [link('pia', ['MEASUREMENT_CREATE', 'MEASUREMENT_VIEW']), link('rosa', ['MEASUREMENT_VIEW'])];
  await loginAsCaregiver();

  appState.selectPatient('pia');
  let state = appState.snapshot();
  assert.equal(state.selectedPatient.id, 'pia');
  assert.equal(state.permissions.write, true, 'antes salía false (permisos del modo demo)');
  assert.equal(state.permissions.read, true);

  // Otro paciente sin permiso de registro.
  appState.selectPatient('rosa');
  state = appState.snapshot();
  assert.equal(state.permissions.write, false);
  assert.equal(state.permissions.read, true);
});

test('si el paciente cambia los permisos, se reflejan al recargar el vínculo', async () => {
  myPatients = [link('pia', ['MEASUREMENT_VIEW'])];
  await loginAsCaregiver();
  appState.selectPatient('pia');
  assert.equal(appState.snapshot().permissions.write, false);

  myPatients = [link('pia', ['MEASUREMENT_VIEW', 'MEASUREMENT_CREATE'])];
  await appState.loadRealPatients();
  assert.equal(appState.snapshot().permissions.write, true);
});

test('el registro envía la medición al paciente seleccionado por el cuidador', async () => {
  myPatients = [link('pia', ['MEASUREMENT_CREATE'])];
  await loginAsCaregiver();
  appState.selectPatient('pia');
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'modules', 'monitoring', 'application', 'readings.ts'), 'utf8');
  assert.match(source, /if \(user\.roles\.includes\('CAREGIVER'\)\) \{\s*const selected = appState\.snapshot\(\)\.selectedPatient;\s*if \(selected\) return selected\.id;/);
  const boundary = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'modules', 'identity', 'presentation', 'components', 'access-boundary.tsx'), 'utf8');
  assert.match(boundary, /path === "\/registrar-medicion" && !permissions\.write/, 'el guardián usa estos permisos');
});
