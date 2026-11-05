const assert = require('node:assert/strict');

const {
  apiErrorFromPayload,
  apiErrorFromResponse,
} = require('../tmp/api-error-tests/services/errors/api-error.js');

async function main() {
  const controlled = apiErrorFromPayload(
    {
      detail: 'El código expiró.',
      errorCode: 'CODE_EXPIRED',
    },
    410,
    'correlation-controlled',
  );

  assert.equal(controlled.code, 'CODE_EXPIRED');
  assert.equal(controlled.message, 'El código expiró.');
  assert.equal(controlled.status, 410);
  assert.equal(controlled.correlationId, 'correlation-controlled');

  const validationDetail = [
    {
      loc: ['body', 'email'],
      msg: 'Field required',
      type: 'missing',
    },
  ];

  const validation = apiErrorFromPayload(
    { detail: validationDetail },
    422,
  );

  assert.equal(validation.code, 'VALIDATION_ERROR');
  assert.equal(validation.message, 'No fue posible validar los datos enviados.');
  assert.deepEqual(validation.details.validation, validationDetail);

  const responseError = await apiErrorFromResponse(
    new Response(
      JSON.stringify({
        detail: 'No posee permiso.',
        errorCode: 'PATIENT_ACCESS_DENIED',
      }),
      {
        status: 403,
        headers: {
          'content-type': 'application/json',
          'x-correlation-id': 'correlation-response',
        },
      },
    ),
  );

  assert.equal(responseError.code, 'PATIENT_ACCESS_DENIED');
  assert.equal(responseError.message, 'No posee permiso.');
  assert.equal(responseError.status, 403);
  assert.equal(responseError.correlationId, 'correlation-response');

  const plainText = await apiErrorFromResponse(
    new Response('Gateway temporalmente no disponible', { status: 503 }),
  );

  assert.equal(plainText.code, 'SERVICE_UNAVAILABLE');
  assert.equal(plainText.message, 'Gateway temporalmente no disponible');

  console.log('API error contract: 4 checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
