import { ApiError, nonEmptyString, isClientApiErrorResponse, isBackendDetailPayload, apiErrorFromClientPayload, apiErrorFromBackendDetailPayload, fallbackCodeForStatus, fallbackMessageForStatus } from '../../../domain/errors/api-error';
export * from '../../../domain/errors/api-error';

/** Convierte una respuesta HTTP fallida a ApiError sin exponer HTML ni datos de validación. */
export async function apiErrorFromResponse(
  response: Response,
  requestCorrelationId?: string,
): Promise<ApiError> {
  const responseCorrelationId = nonEmptyString(response.headers.get('x-correlation-id'));
  const correlationId = responseCorrelationId ?? requestCorrelationId;
  let text = '';
  try { text = (await response.text()).trim(); } catch { /* Cuerpo no disponible. */ }
  let payload: unknown;
  if (text) {
    try { payload = JSON.parse(text) as unknown; } catch { /* Respuesta no JSON. */ }
  }
  if (isClientApiErrorResponse(payload)) {
    return apiErrorFromClientPayload(payload, response.status, correlationId);
  }
  if (isBackendDetailPayload(payload)) {
    return apiErrorFromBackendDetailPayload(payload, response.status, correlationId);
  }
  // Mantener mensajes de texto cortos del Gateway (como lo hacía main).
  // Nunca mostrar HTML, JSON ilegible, traza de servidor ni respuestas extensas.
  const contentType = response.headers.get('content-type') ?? '';
  const plainText = !payload && text.length > 0 && text.length <= 300 &&
    !/[<>]/.test(text) && !/traceback|stack trace|exception at/i.test(text) &&
    !/html|json/i.test(contentType);
  return new ApiError({
    code: fallbackCodeForStatus(response.status),
    message: plainText ? text : fallbackMessageForStatus(response.status),
    details: {}, correlationId, status: response.status,
  });
}

