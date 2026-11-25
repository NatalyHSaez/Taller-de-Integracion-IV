/* global projectRequire */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ApiError, apiErrorFromResponse, normalizeApiError, getApiErrorMessage,
} = projectRequire('src/core/infrastructure/http/errors/api-error.ts');
const { isRetryableApiError, withRetry } = projectRequire('src/core/infrastructure/http/data/retry.ts');

const response = (body, status, correlation = 'servidor-id') => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlation },
});

test('P3: códigos de error y correlación del backend se conservan', async () => {
  for (const [status, code] of [
    [410, 'CODE_EXPIRED'], [404, 'READING_NOT_FOUND'], [403, 'FORBIDDEN'],
    [503, 'AUTHORIZATION_UNAVAILABLE'],
  ]) {
    const error = await apiErrorFromResponse(response({ detail: 'Mensaje seguro', errorCode: code }, status));
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    assert.equal(error.correlationId, 'servidor-id');
    assert.equal(error.message, 'Mensaje seguro');
  }
});

test('P3: FastAPI 422 protege contraseñas y campos de contexto', async () => {
  const secret = 'clave-super-secreta';
  const error = await apiErrorFromResponse(response({ detail: [{
    loc: ['body', 'password'], msg: 'Password too short', type: 'string_too_short',
    input: secret, ctx: { example: secret },
  }] }, 422));
  assert.equal(error.code, 'VALIDATION_ERROR');
  assert.equal(error.details.validation.length, 1);
  assert.deepEqual(Object.keys(error.details.validation[0]).sort(), ['loc', 'msg', 'type']);
  assert.doesNotMatch(JSON.stringify(error.toResponse()), new RegExp(secret));
  assert.doesNotMatch(getApiErrorMessage(error), /Password too short/);
});

test('P3: fallback para códigos HTTP no contractuales', async () => {
  for (const [status, code] of [[400, 'INVALID_REQUEST'], [401, 'AUTHENTICATION_REQUIRED'],
    [403, 'PERMISSION_DENIED'], [404, 'RESOURCE_NOT_FOUND'], [422, 'VALIDATION_ERROR'],
    [429, 'TOO_MANY_REQUESTS'], [503, 'SERVICE_UNAVAILABLE']]) {
    const error = await apiErrorFromResponse(response({ detail: 'Error' }, status));
    assert.equal(error.code, code);
  }
});

test('P3: no se muestran páginas HTML ni trazas técnicas como mensajes', async () => {
  const html = '<html><body>Stack Trace: password=secreto</body></html>';
  const error = await apiErrorFromResponse(new Response(html, { status: 502, headers: {
    'Content-Type': 'text/html', 'X-Correlation-ID': 'respuesta-id',
  } }), 'peticion-id');
  assert.equal(error.code, 'SERVER_ERROR');
  assert.equal(error.correlationId, 'respuesta-id');
  assert.doesNotMatch(error.message, /secreto|html|Stack Trace/i);
});

test('P3: ApiError ya normalizado no pierde el código ni la referencia', () => {
  const local = new ApiError({ code: 'LOCAL', message: 'Prueba' });
  assert.equal(normalizeApiError(local), local);
  assert.equal(normalizeApiError(new Error('fallo local')).code, 'CLIENT_ERROR');
});

test('P3: retry solo en fallos transitorios, nunca en permisos o validación', async () => {
  for (const status of [429, 500, 502, 503, 504]) {
    assert.equal(isRetryableApiError(new ApiError({ code: 'BACKEND_TEMP', status, message: 'Temporal' })), true);
  }
  for (const status of [400, 401, 403, 404, 422]) {
    assert.equal(isRetryableApiError(new ApiError({ code: 'BACKEND_ERROR', status, message: 'No repetir' })), false);
  }
  let attempts = 0;
  const result = await withRetry(async () => {
    if (++attempts < 3) throw new ApiError({ code: 'NETWORK_ERROR', message: 'Red' });
    return 'ok';
  }, { attempts: 3, initialDelayMs: 0 });
  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
});

test('P3: AbortSignal cancelado impide reintentos', async () => {
  const controller = new AbortController();
  controller.abort();
  let attempts = 0;
  await assert.rejects(withRetry(async () => {
    attempts++;
    return 1;
  }, { attempts: 5, initialDelayMs: 0 }, controller.signal), (error) => {
    assert.equal(error.code, 'REQUEST_CANCELLED');
    return true;
  });
  assert.equal(attempts, 0);
});
