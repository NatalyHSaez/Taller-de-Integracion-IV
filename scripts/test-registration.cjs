/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Ejecuta los módulos reales; solo sustituye red y almacenamiento del dispositivo.
function load(file, dependencies, extra = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    }, Error, Date, Headers, Response, AbortController, setTimeout, clearTimeout, ...extra,
  });
  return exports;
}

async function main() {
  const errors = load('services/errors/api-error.ts', {});
  const form = load('services/registration.ts', { './errors': errors });
  const base = { fullName: '  Cuenta Prueba  ', email: ' NUEVA@example.com ',
    password: 'Cuenta123!', confirmation: 'Cuenta123!', privacyAccepted: true,
    role: 'CAREGIVER', birthDate: 'fecha ignorada' };
  const caregiver = form.buildRegistrationRequest(base);
  assert.equal(caregiver.role, 'CAREGIVER');
  assert.equal(caregiver.email, 'nueva@example.com');
  assert.equal(caregiver.fullName, 'Cuenta Prueba');
  assert.equal('birthDate' in caregiver, false);
  const patient = form.buildRegistrationRequest({ ...base, role: 'PATIENT', birthDate: '29/02/2000' });
  assert.equal(patient.birthDate, '2000-02-29');
  for (const value of ['', '31/04/2000', '29/02/2001', '01/01/2999', '00/00/0000']) {
    assert.throws(() => form.buildRegistrationRequest({ ...base, role: 'PATIENT', birthDate: value }));
  }
  for (const patch of [{ fullName: 'ab' }, { fullName: 'a'.repeat(201) },
    { email: 'invalid' }, { password: 'short' }, { password: 'a'.repeat(129) },
    { confirmation: 'different' }, { privacyAccepted: false }]) {
    assert.throws(() => form.buildRegistrationRequest({ ...base, ...patch }));
  }
  let responseStatus = 201;
  let responseBody = { id: 'test-id', fullName: 'Cuenta Prueba', email: base.email.trim().toLowerCase(), roles: ['CAREGIVER'] };
  const calls = [];
  const api = load('services/api.ts', {
    '@/config/api': { API_V1_URL: 'http://test.local/api/v1' },
    '@/services/token-storage': new Proxy({}, { get: () => () => { throw new Error('Register must not access tokens'); } }),
    './errors': errors,
  }, { fetch: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(responseBody), { status: responseStatus, headers: { 'content-type': 'application/json' } });
  } });
  for (const request of [caregiver, patient]) {
    responseBody = { ...responseBody, roles: [request.role] };
    await api.register(request);
    const { url, options } = calls.at(-1);
    assert.equal(url, 'http://test.local/api/v1/auth/register');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.has('Authorization'), false);
    assert.ok(options.headers.get('X-Correlation-ID'));
    assert.equal(JSON.stringify(JSON.parse(options.body)), JSON.stringify(request));
  }
  for (const status of [400, 403, 422, 500]) {
    responseStatus = status;
    responseBody = { detail: status === 422 ? [{ loc: ['body', 'email'], msg: 'invalid', type: 'value_error' }] : 'Error del servidor' };
    const before = calls.length;
    await assert.rejects(api.register(caregiver), (error) => {
      assert.equal(error.status, status);
      assert.ok(form.registrationErrorMessage(error));
      return true;
    });
    assert.equal(calls.length, before + 1, 'Registro no debe reintentarse automáticamente');
  }
  responseStatus = 201;
  responseBody = {};
  await assert.rejects(api.register(caregiver), (error) => error.code === 'INVALID_API_RESPONSE');
  console.log('Registro: validaciones, payloads PATIENT/CAREGIVER, petición pública y errores HTTP aprobados.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
