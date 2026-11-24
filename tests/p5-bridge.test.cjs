/* global mockModule, projectRequire */
'use strict';
/** Pruebas nuevas del contrato P5 contra src/, sin red y sin Expo Go. */
const test = require('node:test');
const assert = require('node:assert/strict');
const patientA = '11111111-1111-4111-8111-111111111111';
const patientB = '22222222-2222-4222-8222-222222222222';
const caregiver = { id: '33333333-3333-4333-8333-333333333333', fullName: 'Cuidador', email: 'cuidador@example.test', roles: ['CAREGIVER'] };
const tokens = { accessToken: 'p5-token', refreshToken: 'p5-refresh', tokenType: 'bearer', expiresIn: 900 };
const link = (id, codes = [], type = 'CAREGIVER') => ({
  patientId: id, relationshipId: `rel-${id}`, fullName: `Paciente ${id}`,
  relationshipType: type, permissions: codes, linkedAt: '2026-11-01T10:00:00Z',
});
let request = async () => [];
mockModule('src/core/infrastructure/http/api-client.ts', {
  setApiAccessTokenProvider() {}, invalidateApiSession() {},
});
mockModule('src/modules/relationships/infrastructure/relationships-api.ts', {
  getMePatients: () => request(),
});
const { authSession } = projectRequire('src/core/application/session/auth-session.ts');
const { demo } = projectRequire('tests/fixtures/demo/demo-store.ts');
const { appState, checkLinkedPatients, permissionsFromCodes } = projectRequire('src/core/application/session/app-state.ts');
projectRequire('composition/configure-app-state.ts');
const { ApiError } = projectRequire('src/core/infrastructure/http/errors/api-error.ts');

function begin(user = caregiver) {
  authSession.clear();
  demo.logout();
  authSession.startBackend(tokens, user);
  demo.startBackendSession(user);
}

test('P5: permisos desconocidos no otorgan acceso ni escritura', () => {
  assert.deepEqual(permissionsFromCodes(['DESCONOCIDO', 'PATIENT_PROFILE_VIEW']), {
    alerts: false, read: false, write: false,
  });
  assert.deepEqual(permissionsFromCodes(['MEASUREMENT_VIEW', 'MEASUREMENT_CREATE']), {
    alerts: false, read: true, write: true,
  });
  assert.deepEqual(permissionsFromCodes(undefined), { alerts: false, read: false, write: false });
});

test('P5: listado del backend rechaza duplicados e identificadores mal formados', () => {
  assert.throws(() => checkLinkedPatients([link(patientA), link(patientA)]),
    (e) => e.code === 'INVALID_API_RESPONSE');
  for (const entry of [null, {}, { ...link(patientA), permissions: null },
    { ...link(patientA), fullName: '' }, { ...link(patientA), relationshipId: '' }]) {
    assert.throws(() => checkLinkedPatients([entry]), (e) => e.code === 'INVALID_API_RESPONSE');
  }
  assert.deepEqual(checkLinkedPatients([link(patientA, ['MEASUREMENT_VIEW']), link(patientB, [], 'DOCTOR')]), [
    link(patientA, ['MEASUREMENT_VIEW']),
  ]);
});

test('P5: un cuidador sin vínculo autorizado no recibe pacientes ni permisos simulados', async () => {
  begin();
  request = async () => [];
  await appState.loadRealPatients();
  const state = appState.snapshot();
  assert.equal(state.sessionMode, 'backend');
  assert.deepEqual(state.patients, []);
  assert.equal(state.selectedPatient, null);
  assert.deepEqual(state.permissions, { alerts: false, read: false, write: false, profile: false });
});

test('P5: los permisos del vínculo seleccionado no se mezclan con otro paciente', async () => {
  begin();
  request = async () => [link(patientA, ['PATIENT_PROFILE_VIEW', 'MEASUREMENT_VIEW']),
    link(patientB, ['MEASUREMENT_CREATE', 'ALERT_VIEW'])];
  await appState.loadRealPatients();
  assert.equal(appState.snapshot().selectedPatient, null);
  appState.selectPatient(patientA);
  assert.deepEqual(appState.snapshot().permissions,
    { alerts: false, read: true, write: false, profile: true });
  appState.selectPatient(patientB);
  assert.deepEqual(appState.snapshot().permissions,
    { alerts: true, read: false, write: true, profile: false });
  appState.selectPatient('no-vinculado');
  assert.equal(appState.snapshot().selectedPatient.id, patientB,
    'seleccionar un vínculo inexistente no debe cambiar la selección');
});

test('P5: 403 descarta vínculos y permisos, sin volver a datos mock', async () => {
  begin();
  request = async () => [link(patientA, ['MEASUREMENT_VIEW'])];
  await appState.loadRealPatients();
  assert.equal(appState.snapshot().selectedPatient?.id, patientA);
  request = async () => { throw new ApiError({ code: 'FORBIDDEN', status: 403, message: 'Acceso denegado' }); };
  await assert.rejects(appState.loadRealPatients(), (e) => e.status === 403);
  const after = appState.snapshot();
  assert.deepEqual(after.patients, []);
  assert.equal(after.selectedPatient, null);
  assert.equal(after.permissions.read, false);
});

test('P5: respuesta tardía de otra sesión no publica pacientes clínicos', async () => {
  begin();
  let resolve;
  request = () => new Promise((done) => { resolve = done; });
  const pending = appState.loadRealPatients();
  authSession.clear();
  demo.logout();
  resolve([link(patientA, ['MEASUREMENT_VIEW'])]);
  await pending;
  const after = appState.snapshot();
  assert.equal(after.user, null);
  assert.equal(after.selectedPatient, null);
});
