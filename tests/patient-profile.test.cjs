/* global projectRequire, __dirname */
/** Ficha del paciente: GET /patients/{id}, nulos, permisos (403/404), cambio de paciente y reintento. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakes, apiError } = require('./support/fakes.cjs');

installFakes();
const {
  createPatientProfile,
  classifyPatientProfileError,
  resolveProfilePatientId,
  formatBirthDate,
  formatAge,
  formatBiologicalSex,
  formatManagementMode,
} = projectRequire('src/modules/identity/application/patient-profile.ts');

const profile = (id, extra = {}) => ({
  id, fullName: `Paciente ${id}`, birthDate: '1950-03-07', age: 76, biologicalSex: 'FEMALE', managementMode: 'autonomo', ...extra,
});

/** Promesa controlable para simular respuestas lentas. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('el paciente activo: el propio paciente o el seleccionado por el cuidador', () => {
  assert.equal(resolveProfilePatientId({ isBackend: true, roles: ['PATIENT'], userId: 'yo', selectedPatientId: 'otro' }), 'yo');
  assert.equal(resolveProfilePatientId({ isBackend: true, roles: ['CAREGIVER'], userId: 'cui', selectedPatientId: 'pia' }), 'pia');
  assert.equal(resolveProfilePatientId({ isBackend: true, roles: ['CAREGIVER'], userId: 'cui', selectedPatientId: null }), null);
  assert.equal(resolveProfilePatientId({ isBackend: false, roles: ['PATIENT'], userId: 'yo', selectedPatientId: 'x' }), null);
});

test('formatos: campos nulos no inventan valores', () => {
  assert.equal(formatBirthDate('1950-03-07'), '07/03/1950');
  assert.equal(formatBirthDate(null), null);
  assert.equal(formatBirthDate('fecha rara'), null);
  assert.equal(formatAge(76), '76 años');
  assert.equal(formatAge(1), '1 año');
  assert.equal(formatAge(null), null);
  assert.equal(formatBiologicalSex('FEMALE'), 'Femenino');
  assert.equal(formatBiologicalSex('m'), 'Masculino');
  assert.equal(formatBiologicalSex(null), null);
  assert.equal(formatBiologicalSex('  '), null);
  assert.equal(formatBiologicalSex('NO_INFORMA'), 'NO_INFORMA', 'un valor desconocido se muestra tal cual');
  assert.match(formatManagementMode('autonomo'), /^Autónomo/);
  assert.match(formatManagementMode('ASSISTED'), /^Asistido/);
  assert.equal(formatManagementMode(null), null);
});

test('carga la ficha del paciente activo y tolera nulos', async () => {
  const store = createPatientProfile(async (id) => profile(id, { birthDate: null, age: null, biologicalSex: null }));
  const opening = store.setPatient('pia');
  assert.equal(store.getState().loading, true);
  await opening;
  const state = store.getState();
  assert.equal(state.patientId, 'pia');
  assert.equal(state.profile.fullName, 'Paciente pia');
  assert.equal(state.profile.birthDate, null);
  assert.equal(state.error, null);
});

test('cambiar de paciente invalida la ficha anterior y descarta respuestas tardías', async () => {
  const pending = {};
  const store = createPatientProfile((id) => {
    pending[id] = deferred();
    return pending[id].promise;
  });
  const first = store.setPatient('pia');
  pending.pia.resolve(profile('pia'));
  await first;
  assert.equal(store.getState().profile.id, 'pia');

  const slow = store.setPatient('rosa');
  assert.equal(store.getState().profile, null, 'no se muestra la ficha de pía mientras carga rosa');
  const fast = store.setPatient('ana');
  pending.ana.resolve(profile('ana'));
  await fast;
  pending.rosa.resolve(profile('rosa'));
  await slow;
  assert.equal(store.getState().patientId, 'ana');
  assert.equal(store.getState().profile.id, 'ana', 'la respuesta tardía de rosa se descarta');

  await store.setPatient(null);
  assert.equal(store.getState().profile, null);
});

test('una ficha de otro paciente no se acepta', async () => {
  const store = createPatientProfile(async () => profile('otro'));
  await store.setPatient('pia');
  assert.equal(store.getState().profile, null);
  assert.equal(store.getState().error.kind, 'not_found');
});

test('403 explica el permiso, 404 que no existe, 401 la sesión; solo la red reintenta', () => {
  const forbidden = classifyPatientProfileError(apiError('FORBIDDEN', 403));
  assert.equal(forbidden.kind, 'forbidden');
  assert.match(forbidden.message, /permiso/);
  assert.equal(forbidden.retryable, false);

  const notFound = classifyPatientProfileError(apiError('PATIENT_NOT_FOUND', 404));
  assert.equal(notFound.kind, 'not_found');
  assert.equal(notFound.title, 'Paciente no encontrado');
  assert.equal(notFound.retryable, false);

  assert.equal(classifyPatientProfileError(apiError('AUTHENTICATION_REQUIRED', 401)).kind, 'session');

  const network = classifyPatientProfileError(new TypeError('Network request failed'));
  assert.equal(network.kind, 'network');
  assert.equal(network.retryable, true);
});

test('error sin datos y reintento que recupera la ficha', async () => {
  let fail = true;
  const store = createPatientProfile(async (id) => {
    if (fail) throw new TypeError('Network request failed');
    return profile(id);
  });
  await store.setPatient('pia');
  assert.equal(store.getState().profile, null, 'sin datos simulados');
  assert.equal(store.getState().error.kind, 'network');
  fail = false;
  await store.retry();
  assert.equal(store.getState().error, null);
  assert.equal(store.getState().profile.id, 'pia');
});

test('la pantalla usa la ficha real y oculta el aviso demo con sesión backend', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'app', 'paciente-vinculado.tsx'), 'utf8');
  assert.match(source, /createPatientProfile\(\)/);
  for (const field of ['formatAge', 'formatBiologicalSex', 'formatManagementMode', 'formatBirthDate']) {
    assert.match(source, new RegExp(field));
  }
  assert.match(source, /profileStore\.retry\(\)/);
  assert.match(source, /!isRealSession && \(\s*<View/);
});
