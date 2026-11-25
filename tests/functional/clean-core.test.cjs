/* global projectRequire, mockModule */
const test = require('node:test');
const assert = require('node:assert/strict');
mockModule('src/core/infrastructure/http/api-client.ts', {
  setApiAccessTokenProvider() {}, invalidateApiSession() {},
});
const { authSession } = projectRequire('src/core/application/session/auth-session.ts');
const { appState, configureAppState } = projectRequire('src/core/application/session/app-state.ts');
const tokens = { accessToken: 'token', refreshToken: 'refresh', tokenType: 'bearer', expiresIn: 900 };
const caregiver = { id: 'caregiver', fullName: 'Cuidador', email: 'c@example.test', roles: ['CAREGIVER'] };
const link = { patientId: 'patient', fullName: 'Paciente', relationshipId: 'rel', relationshipType: 'CAREGIVER', permissions: ['ALERT_VIEW'], linkedAt: '2026-11-01T00:00:00Z' };

test('core: sin composición no concede permisos ni consulta datos', async () => {
  authSession.startBackend(tokens, caregiver);
  await assert.rejects(appState.loadRealPatients(), error => error.code === 'APP_STATE_NOT_CONFIGURED');
  assert.equal(appState.snapshot().selectedPatient, null);
  assert.equal(appState.snapshot().permissions.alerts, false);
  authSession.clear();
});

test('core: consulta mediante contrato inyectado y limpia caché al fallar', async () => {
  let fail = false, requests = 0, clears = 0;
  configureAppState({ listLinkedPatients: async () => { requests++; if (fail) throw new Error('red'); return [link]; }, clearClinicalCache: () => { clears++; } });
  authSession.startBackend(tokens, caregiver);
  await appState.loadRealPatients();
  assert.equal(requests, 1);
  assert.equal(appState.snapshot().selectedPatient.id, 'patient');
  assert.equal(appState.snapshot().permissions.alerts, true);
  fail = true;
  await assert.rejects(appState.loadRealPatients(), /red/);
  assert.equal(clears, 1);
  assert.equal(appState.snapshot().selectedPatient, null);
  assert.equal(appState.snapshot().permissions.alerts, false);
  authSession.clear();
});
