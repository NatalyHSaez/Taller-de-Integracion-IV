/* global projectRequire, mockModule */
const test = require('node:test');
const assert = require('node:assert/strict');
const user = { id: '00000000-0000-4000-8000-00000000b001', fullName: 'Paciente de prueba', email: 'paciente@example.com', roles: ['PATIENT'], doctorStatus: null };
const profile = { id: user.id, fullName: user.fullName, birthDate: null, age: null, biologicalSex: null, managementMode: null };
const tokens = { accessToken: 'test-access', refreshToken: 'test-refresh', tokenType: 'bearer', expiresIn: 900 };
let reply;
const calls = [];
const saves = [];
const request = async (method, path, body) => { calls.push({ method, path, body }); return reply; };
mockModule('src/core/infrastructure/http/api-client.ts', {
  apiSessionRevision: () => 0,
  apiClient: {
    get: path => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
  },
});
mockModule('src/core/infrastructure/storage/token-storage.ts', { saveTokens: async (...args) => { saves.push(args); } });
const api = projectRequire('src/modules/identity/infrastructure/api/identity-api.ts');
const { isAuthTokensResponse, isCurrentUserResponse } = projectRequire('src/core/domain/contracts/auth.ts');
const invalid = error => error.code === 'INVALID_API_RESPONSE';

test('identidad: doctorStatus admite null y estados reales sin transformar el rol', () => {
  assert.ok(isCurrentUserResponse(user));
  assert.ok(isCurrentUserResponse({ ...user, roles: ['DOCTOR'], doctorStatus: 'PENDING' }));
  assert.ok(isCurrentUserResponse({ ...user, doctorStatus: undefined }));
  for (const patch of [{ doctorStatus: 1 }, { id: '' }, { roles: ['paciente'] }, { roles: [] }, { email: '' }, { fullName: ' ' }]) {
    assert.equal(isCurrentUserResponse({ ...user, ...patch }), false);
  }
});

test('identidad: GET y PATCH /me validan respuestas antes de entregarlas', async () => {
  reply = user;
  assert.deepEqual(await api.getMe(), user);
  assert.deepEqual(await api.updateMe({ fullName: 'Nombre actualizado' }), user);
  assert.deepEqual(calls.slice(-2), [{ method: 'GET', path: '/me', body: undefined }, { method: 'PATCH', path: '/me', body: { fullName: 'Nombre actualizado' } }]);
  reply = { ...user, id: null };
  await assert.rejects(api.getMe(), invalid);
  await assert.rejects(api.updateMe({ fullName: 'Nombre actualizado' }), invalid);
});

test('identidad: registro rechaza id o rol no confirmado por el servidor', async () => {
  const data = { fullName: user.fullName, email: user.email, role: 'PATIENT', birthDate: '1990-01-01', password: 'Test1234!' };
  reply = user;
  assert.deepEqual(await api.register(data), user);
  reply = { ...user, id: 'invalid' };
  await assert.rejects(api.register(data), invalid);
  reply = { ...user, roles: ['CAREGIVER'] };
  await assert.rejects(api.register(data), invalid);
});

test('identidad: login guarda solo respuestas completas de token bearer', async () => {
  assert.ok(isAuthTokensResponse(tokens));
  reply = tokens;
  await api.login(user.email, 'Test1234!');
  assert.deepEqual(saves, [['test-access', 'test-refresh']]);
  for (const patch of [{ accessToken: 123 }, { refreshToken: ' ' }, { tokenType: 'basic' }, { expiresIn: 0 }, { expiresIn: '900' }, { expiresIn: null }, { expiresIn: 2.5 }]) {
    reply = { ...tokens, ...patch };
    await assert.rejects(api.login(user.email, 'Test1234!'), invalid);
  }
  assert.equal(saves.length, 1);
});

test('identidad: ficha admite campos nulos pero no incompletos ni otro paciente', async () => {
  reply = profile;
  assert.deepEqual(await api.getPatient(user.id), profile);
  assert.equal(calls.at(-1).path, `/patients/${user.id}`);
  for (const patch of [{ id: undefined }, { managementMode: undefined }, { age: '43' }, { birthDate: '2026-02-30' }, { biologicalSex: 2 }]) {
    reply = { ...profile, ...patch };
    await assert.rejects(api.getPatient(user.id), invalid);
  }
  reply = { ...profile, id: '00000000-0000-4000-8000-00000000b002' };
  await assert.rejects(api.getPatient(user.id), e => e.code === 'PATIENT_NOT_FOUND' && e.status === 404);
});
