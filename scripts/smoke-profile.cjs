// Crea dos cuentas ficticias para verificar edición de perfil en Docker local. Ejecución explícita, no forma parte de tests unitarios.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = 'http://localhost:8000/api/v1';
async function request(path, method, body, token) {
  const response = await fetch(base + path, {
    method, signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
}
async function main() {
  for (const role of ['PATIENT', 'CAREGIVER']) {
    const email = `ti463.${randomUUID()}@example.com`;
    const password = `Test-${randomUUID()}`;
    const registered = await request('/auth/register', 'POST', {
      fullName: 'Prueba Perfil Original', email, password, role,
      ...(role === 'PATIENT' ? { birthDate: '2000-01-01' } : {}),
    });
    assert.equal(registered.status, 201);
    let refreshToken;
    try {
      let login = await request('/auth/login', 'POST', { email, password });
      assert.equal(login.status, 200);
      refreshToken = login.data.refreshToken;
      const fullName = `Prueba Perfil ${role}`;
      const patch = await request('/me', 'PATCH', { fullName }, login.data.accessToken);
      assert.equal(patch.status, 200);
      assert.equal(patch.data.fullName, fullName);
      assert.equal(patch.data.id, registered.data.id);
      assert.equal(patch.data.email, email);
      assert.deepEqual(patch.data.roles, [role]);
      const invalid = await request('/me', 'PATCH', { fullName: 'ab' }, login.data.accessToken);
      assert.equal(invalid.status, 422);
      assert.equal((await request('/me', 'GET', undefined, login.data.accessToken)).data.fullName, fullName);
      assert.equal((await request('/auth/logout', 'POST', { refreshToken })).status, 204);
      login = await request('/auth/login', 'POST', { email, password });
      assert.equal(login.status, 200);
      refreshToken = login.data.refreshToken;
      assert.equal((await request('/me', 'GET', undefined, login.data.accessToken)).data.fullName, fullName);
      console.log(`${role}: PATCH 200, inválido 422 sin cambios, GET y nuevo login conservan el nombre.`);
    } finally {
      if (refreshToken) await request('/auth/logout', 'POST', { refreshToken });
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
