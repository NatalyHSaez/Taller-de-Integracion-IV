// Ejecutar desde la raíz con: node scripts/test-p3.cjs
// Usa TypeScript ya declarado en devDependencies. No conecta Docker ni SecureStore.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
const originalTs = Module._extensions['.ts'];
const originalFetch = global.fetch;
const originalDev = global.__DEV__;
const tokens = { access: null, refresh: null };
const storagePath = path.join(root, 'services/token-storage.ts');
const configPath = path.join(root, 'config/api.ts');
let checks = 0;

// Solo se aíslan la configuración de red y el almacenamiento nativo.
// El cliente HTTP, ApiError, caché, reintentos, sesión, servicios y mocks son reales.
Module._resolveFilename = function (request, parent, ...rest) {
  const target = request.startsWith('@/') ? path.join(root, request.slice(2)) : request;
  return originalResolve.call(this, target, parent, ...rest);
};
Module._extensions['.ts'] = function (module, filename) {
  if (filename === configPath) {
    module.exports = { API_V1_URL: 'http://p3.invalid/api/v1', IS_API_CONFIGURED: true };
    return;
  }
  if (filename === storagePath) {
    module.exports = {
      getAccessToken: async () => tokens.access,
      getRefreshToken: async () => tokens.refresh,
      saveTokens: async (access, refresh) => { tokens.access = access; tokens.refresh = refresh; },
      clearTokens: async () => { tokens.access = null; tokens.refresh = null; },
    };
    return;
  }
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};
global.__DEV__ = false;

const { ApiError, apiErrorFromResponse, apiErrorFromPayload, normalizeApiError,
  isApiErrorResponse, getApiErrorMessage } = require('../services/errors');
const { apiClient } = require('../services/api');
const { dataClient } = require('../services/data');
const { withRetry, isRetryableApiError } = require('../services/data/retry');
const { authSession } = require('../services/auth-session');
const { getNotifications } = require('../services/notifications');
const { readingsService } = require('../services/readings');
const { demo } = require('../services/demo-store');
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', ...headers },
});
const backend = () => authSession.startBackend({
  accessToken: 'test-access', refreshToken: 'test-refresh', tokenType: 'bearer', expiresIn: 900,
});
async function check(name, run) {
  dataClient.clearCache(); tokens.access = null; tokens.refresh = null;
  global.fetch = async () => { throw new Error('Unexpected fetch'); };
  await run(); checks++; console.log(`OK ${name}`);
}
const rejectsCode = (code, status) => (error) => {
  assert.ok(error instanceof ApiError); assert.equal(error.code, code);
  if (status !== undefined) assert.equal(error.status, status);
  return true;
};

async function main() {
  for (const [status, code] of [[410, 'CODE_EXPIRED'], [404, 'READING_NOT_FOUND'],
    [403, 'FORBIDDEN'], [422, 'INCOMPLETE_BLOOD_PRESSURE'], [503, 'AUTHORIZATION_UNAVAILABLE']]) {
    await check(`Contrato ${status} ${code}`, async () => {
      const error = await apiErrorFromResponse(json({ errorCode: code, detail: 'Mensaje legible.' }, status,
        { 'X-Correlation-ID': 'server-correlation' }));
      assert.equal(error.code, code); assert.equal(error.message, 'Mensaje legible.');
      assert.equal(error.status, status); assert.equal(error.correlationId, 'server-correlation');
    });
  }
  await check('422: estructura de validación sin input/ctx ni texto técnico en UI', async () => {
    const error = await apiErrorFromResponse(json({ detail: [
      { loc: ['body', 'password'], msg: 'String should have at least 8 characters', type: 'string_too_short',
        input: 'test-secret', ctx: { min_length: 8 } },
      { loc: ['body', 'measurements', 0, 'value'], msg: 'Field required', type: 'missing' },
    ] }, 422));
    assert.equal(error.code, 'VALIDATION_ERROR'); assert.equal(error.status, 422);
    assert.equal(error.details.validation.length, 2);
    assert.deepEqual(Object.keys(error.details.validation[0]).sort(), ['loc', 'msg', 'type']);
    assert.doesNotMatch(JSON.stringify(error.toResponse()), /test-secret|min_length/);
    assert.match(getApiErrorMessage(error), /Revisa los campos/);
    assert.doesNotMatch(error.message, /String should|Field required|\[object Object\]/);
  });
  await check('422: elementos inesperados no rompen el parser', async () => {
    const error = await apiErrorFromResponse(json({ detail: [null, 7, {}, { loc: 'bad' }] }, 422));
    assert.equal(error.code, 'VALIDATION_ERROR'); assert.deepEqual(error.details.validation, []);
  });
  await check('errorCode tiene prioridad sobre codigo_error', async () => {
    const error = await apiErrorFromResponse(json({ detail: 'Expiró', errorCode: 'CODE_EXPIRED', codigo_error: 'OLD' }, 410));
    assert.equal(error.code, 'CODE_EXPIRED');
    assert.equal(normalizeApiError({ detail: 'Viejo', codigo_error: 'OLD' }).code, 'OLD');
  });
  for (const [status, code] of [[400, 'INVALID_REQUEST'], [401, 'AUTHENTICATION_REQUIRED'],
    [403, 'PERMISSION_DENIED'], [404, 'RESOURCE_NOT_FOUND'], [408, 'REQUEST_TIMEOUT'],
    [409, 'CONFLICT'], [410, 'RESOURCE_GONE'], [422, 'VALIDATION_ERROR'],
    [429, 'TOO_MANY_REQUESTS'], [503, 'SERVICE_UNAVAILABLE']]) {
    await check(`Fallback HTTP ${status} sin errorCode`, async () => {
      assert.equal((await apiErrorFromResponse(json({ detail: 'Mensaje' }, status))).code, code);
    });
  }
  for (const body of ['', '<html>proxy failure</html>', '{broken', '{"debug":"internal"}', 'Internal Server Error']) {
    await check(`Cuerpo no contractual: ${body.slice(0, 24) || 'vacío'}`, async () => {
      const error = await apiErrorFromResponse(new Response(body, { status: 502 }), 'request-id');
      assert.equal(error.code, 'SERVER_ERROR'); assert.equal(error.status, 502);
      assert.equal(error.correlationId, 'request-id');
      assert.equal(error.message, 'El servidor no pudo completar la solicitud.');
    });
  }
  await check('Fallo al leer cuerpo conserva estado y correlación', async () => {
    const error = await apiErrorFromResponse({ status: 403, headers: new Headers(), text: async () => { throw Error(); } }, 'request-id');
    assert.equal(error.status, 403); assert.equal(error.correlationId, 'request-id');
  });
  await check('Compatibilidad local y prioridad de correlación de respuesta', async () => {
    const local = new ApiError({ code: 'LOCAL', message: 'Mensaje', correlationId: 'local-id' });
    assert.equal(normalizeApiError(local), local);
    assert.equal(apiErrorFromPayload(local.toResponse()).code, 'LOCAL');
    const parsed = await apiErrorFromResponse(json(local.toResponse(), 409, { 'X-Correlation-ID': 'server-id' }), 'request-id');
    assert.equal(parsed.correlationId, 'server-id'); assert.equal(parsed.status, 409);
    assert.ok(isApiErrorResponse({ detail: 'Error', errorCode: 'CODE' }));
    assert.equal(isApiErrorResponse(local.toResponse()), false);
    assert.equal(isApiErrorResponse({ detail: [null] }), false);
  });
  await check('Normalización unknown y validación sin estado inventado', async () => {
    assert.equal(normalizeApiError(undefined, 'Fallback').message, 'Fallback');
    assert.equal(normalizeApiError(Error('Mensaje local')).code, 'CLIENT_ERROR');
    const error = normalizeApiError({ detail: [] });
    assert.equal(error.code, 'VALIDATION_ERROR'); assert.equal(error.status, undefined);
  });
  await check('Cliente HTTP: código, status e ID de la respuesta', async () => {
    global.fetch = async () => json({ detail: 'Sin permiso', errorCode: 'FORBIDDEN' }, 403, { 'X-Correlation-ID': 'server-id' });
    await assert.rejects(apiClient.get('/patients/test', { auth: false }), (error) => {
      rejectsCode('FORBIDDEN', 403)(error); assert.equal(error.correlationId, 'server-id'); return true;
    });
  });
  await check('Cliente HTTP: sin cabecera de respuesta conserva ID enviado', async () => {
    let sent;
    global.fetch = async (_url, options) => {
      sent = options.headers.get('X-Correlation-ID'); return json({ detail: 'No encontrado' }, 404);
    };
    await assert.rejects(apiClient.get('/readings/test', { auth: false }), (error) => {
      assert.ok(sent); assert.equal(error.correlationId, sent); return true;
    });
  });
  await check('Fallo de red normalizado y correlacionado', async () => {
    global.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(apiClient.get('/health', { auth: false, headers: { 'X-Correlation-ID': 'network-id' } }), (error) => {
      rejectsCode('NETWORK_ERROR')(error); assert.equal(error.correlationId, 'network-id'); return true;
    });
  });
  await check('Timeout y cancelación se distinguen', async () => {
    global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      const abort = () => reject(new DOMException('Aborted', 'AbortError'));
      if (options.signal.aborted) abort(); else options.signal.addEventListener('abort', abort, { once: true });
    });
    await assert.rejects(apiClient.get('/slow', { auth: false, timeoutMs: 5 }), rejectsCode('REQUEST_TIMEOUT'));
    const controller = new AbortController(); controller.abort();
    await assert.rejects(apiClient.get('/cancel', { auth: false, signal: controller.signal }), rejectsCode('REQUEST_CANCELLED'));
  });
  for (const status of [400, 401, 403, 404, 409, 410, 422, 501, 505]) {
    await check(`Sin reintento ni caché de respaldo en HTTP ${status}`, async () => {
      const url = `/denied-${status}`;
      global.fetch = async () => json({ old: true });
      await dataClient.get(url, { auth: false, retry: false, cache: { ttlMs: 0 } });
      let calls = 0;
      global.fetch = async () => { calls++; return json({ detail: 'Error', errorCode: 'SERVER_ERROR' }, status); };
      await assert.rejects(dataClient.get(`/denied-${status}`, {
        auth: false, retry: { attempts: 3, initialDelayMs: 0 },
      }), rejectsCode('SERVER_ERROR', status));
      assert.equal(calls, 1); assert.equal(dataClient.cacheSize(), 0);
    });
  }
  await check('Solo estados transitorios, independientemente del errorCode', async () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      assert.ok(isRetryableApiError(new ApiError({ status, code: 'NEW_BACKEND_CODE', message: 'Temporal' })));
    }
    assert.equal(isRetryableApiError(new ApiError({ code: 'REQUEST_CANCELLED', status: 503, message: 'Cancelado' })), false);
    let attempts = 0;
    const value = await withRetry(async () => {
      if (++attempts < 3) throw new ApiError({ code: 'NETWORK_ERROR', message: 'Red' });
      return 42;
    }, { attempts: 3, initialDelayMs: 0 });
    assert.equal(value, 42); assert.equal(attempts, 3);
  });
  await check('Caché expirada permitida solo en fallo transitorio', async () => {
    global.fetch = async () => json({ actual: true });
    await dataClient.get('/cached', { auth: false, retry: false, cache: { ttlMs: 0 } });
    global.fetch = async () => json({ detail: 'Temporal', errorCode: 'AUTHORIZATION_UNAVAILABLE' }, 503);
    assert.deepEqual(await dataClient.get('/cached', { auth: false, retry: false, cache: { staleIfErrorMs: 300000 } }), { actual: true });
  });
  await check('Una petición de sesión anterior no lee la caché de la nueva', async () => {
    let complete;
    global.fetch = () => new Promise((resolve) => { complete = resolve; });
    const pending = dataClient.get('/session-cache', { auth: false, retry: false });
    await new Promise((resolve) => setImmediate(resolve));
    dataClient.clearCache();
    complete(json({ detail: 'Temporal' }, 503));
    await assert.rejects(pending, rejectsCode('SESSION_CHANGED'));
  });
  await check('Notificaciones: 403 se propaga y no genera mocks', async () => {
    backend(); let calls = 0;
    global.fetch = async () => { calls++; return json({ detail: 'Sin permiso', errorCode: 'FORBIDDEN' }, 403); };
    await assert.rejects(getNotifications(), rejectsCode('FORBIDDEN', 403)); assert.equal(calls, 1);
  });
  await check('Notificaciones: éxito real no mezcla notificaciones demo', async () => {
    backend(); global.fetch = async () => json({ items: [] });
    assert.deepEqual(await getNotifications(), []);
  });
  await check('Notificaciones: sesión cerrada no habilita mocks', async () => {
    authSession.clear(); await assert.rejects(getNotifications(), rejectsCode('AUTHENTICATION_REQUIRED', 401));
  });
  await check('Modo mock explícito conserva sus datos sin llamar a fetch', async () => {
    demo.login('paciente@ejemplo.com', 'Paciente123');
    authSession.startMock({ accessToken: 'mock', refreshToken: 'mock', tokenType: 'bearer', expiresIn: 900 },
      { id: demo.user().id, fullName: 'Demo', email: 'paciente@ejemplo.com', roles: ['PATIENT'] });
    assert.ok(Array.isArray(await getNotifications()));
  });
  await check('Detalle de lectura: error backend no se reemplaza por lectura local', async () => {
    // Desde S2 el detalle solo consulta la API con un paciente autorizado y UUID válidos.
    // La prueba P3 debe llegar a la respuesta HTTP 404, no detenerse en el control 401.
    const patientId = '25b78bc3-8a8d-48d0-8a7c-c9346beae2ed';
    const readingId = '88888888-8888-4888-8888-888888888881';
    backend();
    authSession.setUser({ id: patientId, fullName: 'Paciente de prueba',
      email: 'paciente@p3.invalid', roles: ['PATIENT'] });
    let calls = 0;
    global.fetch = async (url) => {
      calls += 1;
      assert.ok(String(url).includes(`/patients/${patientId}/readings/${readingId}`));
      return json({ detail: 'Lectura no encontrada', errorCode: 'READING_NOT_FOUND' }, 404);
    };
    await assert.rejects(readingsService.detail(patientId, readingId), rejectsCode('READING_NOT_FOUND', 404));
    assert.equal(calls, 1, 'La prueba debe haber consultado realmente el Gateway simulado.');
  });
  console.log(`\n${checks} comprobaciones P3 correctas.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch; global.__DEV__ = originalDev;
  Module._resolveFilename = originalResolve;
  if (originalTs) Module._extensions['.ts'] = originalTs; else delete Module._extensions['.ts'];
});
