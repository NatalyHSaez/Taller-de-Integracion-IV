// Crea dos cuentas ficticias en Docker local. Ejecución explícita, no forma parte de tests unitarios.
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
  for (const role of ['CAREGIVER', 'PATIENT']) {
    const payload = { fullName: `Prueba Registro ${role}`, email: `ti461.${randomUUID()}@example.com`,
      password: `Test-${randomUUID()}`, role,
      ...(role === 'PATIENT' ? { birthDate: '2000-02-29' } : {}),
    };
    const registered = await request('/auth/register', 'POST', payload);
    assert.equal(registered.status, 201, `Registro ${role}: ${JSON.stringify(registered)}`);
    assert.ok(registered.data.id);
    assert.ok(registered.data.roles.includes(role));
    assert.equal(registered.data.email, payload.email);
    assert.equal(registered.data.fullName, payload.fullName);
    assert.equal((await request('/auth/register', 'POST', payload)).status, 400);
    const login = await request('/auth/login', 'POST', { email: payload.email, password: payload.password });
    assert.equal(login.status, 200);
    try {
      const me = await request('/me', 'GET', undefined, login.data.accessToken);
      assert.equal(me.status, 200);
      assert.equal(me.data.id, registered.data.id);
      assert.ok(me.data.roles.includes(role));
    } finally {
      assert.equal((await request('/auth/logout', 'POST', { refreshToken: login.data.refreshToken })).status, 204);
    }
    console.log(`${role}: registro 201, duplicado 400, login 200, /me 200, logout 204. Cuenta ficticia: ${payload.email}`);
  }
  const invalid = await request('/auth/register', 'POST', {
    fullName: 'Paciente sin fecha', email: `ti461.${randomUUID()}@example.com`, password: 'Test-123456', role: 'PATIENT',
  });
  assert.equal(invalid.status, 422);
  console.log('PATIENT sin birthDate: 422 confirmado.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
