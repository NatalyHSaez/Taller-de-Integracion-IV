/* global projectRequire */
const test = require('node:test');
const assert = require('node:assert/strict');
const { identityDependencies } = projectRequire('src/modules/identity/application/identity-port.ts');
const { authSession, configureAuthSession } = projectRequire('src/core/application/session/auth-session.ts');
const { authService } = projectRequire('src/modules/identity/application/authservice.ts');

test('identidad sin composición rechaza el registro en lugar de consultar un adaptador implícito', async () => {
  assert.throws(() => identityDependencies(), /no está configurado/);
  await assert.rejects(authService.register({}), /no está configurado/);
});

test('el estado de sesión invalida el transporte solo al iniciar o cerrar sesión', () => {
  let invalidations = 0;
  configureAuthSession(() => { invalidations++; });
  const tokens = { accessToken: 'a', refreshToken: 'r', tokenType: 'bearer', expiresIn: 900 };
  authSession.startBackend(tokens);
  const generation = authSession.generation();
  authSession.updateTokens({ ...tokens, accessToken: 'b' });
  assert.equal(invalidations, 1);
  assert.equal(authSession.generation(), generation);
  assert.equal(authSession.accessToken(), 'b');
  authSession.clear();
  assert.equal(invalidations, 2);
  assert.equal(authSession.accessToken(), null);
});
