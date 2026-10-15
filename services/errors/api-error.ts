import type { ApiErrorResponse, UUID } from '@/types/api';

export type ApiErrorInit = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  correlationId?: UUID;
  status?: number;
};

type BackendDetailErrorResponse = {
  detail: unknown;
  codigo_error?: unknown;
};

/**
 * Error único utilizado por la aplicación para representar fallos de API.
 *
 * La app conserva una sola estructura interna aunque el backend responda hoy
 * con el formato de FastAPI (`detail`) o, progresivamente, con un código estable
 * (`codigo_error`). También sigue aceptando el formato común definido
 * originalmente en la propuesta.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly correlationId: UUID;
  readonly status?: number;

  constructor({
    code,
    message,
    details = {},
    correlationId = createClientCorrelationId(),
    status,
  }: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.correlationId = correlationId;
    this.status = status;
  }

  /** Devuelve el error con la forma común utilizada internamente por el móvil. */
  toResponse(): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        correlationId: this.correlationId,
      },
    };
  }
}

function createClientCorrelationId(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Comprueba si un JSON respeta el formato común original de la propuesta. */
export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!isRecord(value) || !isRecord(value.error)) {
    return false;
  }

  const error = value.error;

  return (
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    isRecord(error.details) &&
    typeof error.correlationId === 'string'
  );
}

/**
 * Formato que utiliza actualmente FastAPI y que el contrato de Integración II
 * está extendiendo con `codigo_error` estable.
 *
 * Ejemplos:
 *   { "detail": "Credenciales inválidas" }
 *   { "detail": "El código expiró.", "codigo_error": "CODIGO_EXPIRADO" }
 */
function isBackendDetailErrorResponse(
  value: unknown,
): value is BackendDetailErrorResponse {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'detail');
}

function fallbackCodeForStatus(status?: number): string {
  switch (status) {
    case 400:
      return 'INVALID_REQUEST';
    case 401:
      return 'AUTHENTICATION_REQUIRED';
    case 403:
      return 'PERMISSION_DENIED';
    case 404:
      return 'RESOURCE_NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 410:
      return 'RESOURCE_GONE';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'TOO_MANY_REQUESTS';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      if (status !== undefined && status >= 500) {
        return 'SERVER_ERROR';
      }
      return status === undefined ? 'API_ERROR' : 'HTTP_ERROR';
  }
}

function fallbackMessageForStatus(status?: number): string {
  switch (status) {
    case 400:
      return 'La solicitud contiene datos inválidos.';
    case 401:
      return 'Debes iniciar sesión para continuar.';
    case 403:
      return 'No posee permiso para realizar esta operación.';
    case 404:
      return 'El recurso solicitado no existe.';
    case 409:
      return 'La operación entra en conflicto con el estado actual.';
    case 410:
      return 'El recurso solicitado ya no se encuentra disponible.';
    case 422:
      return 'No fue posible validar los datos enviados.';
    case 429:
      return 'Se realizaron demasiados intentos. Intenta nuevamente más tarde.';
    case 503:
      return 'El servicio no se encuentra disponible temporalmente.';
    default:
      if (status !== undefined && status >= 500) {
        return 'El servidor no pudo completar la solicitud.';
      }
      return status === undefined
        ? 'Ocurrió un error al procesar la solicitud.'
        : `La solicitud falló con código HTTP ${status}.`;
  }
}

function correlationIdFromResponse(response: Response): UUID | undefined {
  const correlationId = response.headers.get('x-correlation-id')?.trim();
  return correlationId || undefined;
}

function messageFromBackendDetail(detail: unknown, status?: number): string {
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim();
  }

  // FastAPI responde 422 con una lista de errores de validación. Esos mensajes
  // son detalles técnicos, por lo que la UI recibe un texto estable en español.
  if (Array.isArray(detail)) {
    return fallbackMessageForStatus(status ?? 422);
  }

  if (isRecord(detail) && typeof detail.message === 'string' && detail.message.trim()) {
    return detail.message.trim();
  }

  return fallbackMessageForStatus(status);
}

function detailsFromBackendDetail(detail: unknown): Record<string, unknown> {
  if (Array.isArray(detail)) {
    return { validation: detail };
  }

  if (isRecord(detail)) {
    return { detail };
  }

  return {};
}

/** Convierte el formato común original en una instancia uniforme para la app. */
export function apiErrorFromPayload(
  payload: ApiErrorResponse,
  status?: number,
): ApiError {
  return new ApiError({
    code: payload.error.code,
    message: payload.error.message,
    details: payload.error.details,
    correlationId: payload.error.correlationId,
    status,
  });
}

/**
 * Convierte la respuesta de error usada actualmente por Integración II
 * (`detail` + `codigo_error` opcional) al ApiError interno.
 */
function apiErrorFromBackendDetailPayload(
  payload: BackendDetailErrorResponse,
  status?: number,
  correlationId?: UUID,
): ApiError {
  const stableCode =
    typeof payload.codigo_error === 'string' && payload.codigo_error.trim()
      ? payload.codigo_error.trim()
      : fallbackCodeForStatus(status);

  return new ApiError({
    code: stableCode,
    message: messageFromBackendDetail(payload.detail, status),
    details: detailsFromBackendDetail(payload.detail),
    correlationId,
    status,
  });
}

async function readResponseBody(
  response: Response,
): Promise<{ payload?: unknown; text?: string }> {
  let text: string;

  try {
    text = await response.text();
  } catch {
    return {};
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }

  try {
    return { payload: JSON.parse(trimmed) as unknown, text: trimmed };
  } catch {
    return { text: trimmed };
  }
}

/**
 * Convierte una respuesta HTTP fallida en ApiError.
 *
 * Orden de interpretación:
 * 1. formato común original `{ error: ... }`;
 * 2. formato actual del backend `{ detail, codigo_error? }`;
 * 3. cuerpo de texto simple;
 * 4. mensaje genérico según el código HTTP.
 */
export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  const { payload, text } = await readResponseBody(response);
  const responseCorrelationId = correlationIdFromResponse(response);

  if (isApiErrorResponse(payload)) {
    return apiErrorFromPayload(payload, response.status);
  }

  if (isBackendDetailErrorResponse(payload)) {
    return apiErrorFromBackendDetailPayload(
      payload,
      response.status,
      responseCorrelationId,
    );
  }

  return new ApiError({
    code: fallbackCodeForStatus(response.status),
    message:
      text && text.length <= 300 ? text : fallbackMessageForStatus(response.status),
    details: {},
    correlationId: responseCorrelationId,
    status: response.status,
  });
}

/**
 * Recibe cualquier error desconocido de JavaScript y lo transforma a ApiError.
 * Esto evita que cada pantalla tenga que decidir cómo interpretar el catch.
 */
export function normalizeApiError(
  cause: unknown,
  fallbackMessage = 'Ocurrió un error inesperado.',
): ApiError {
  if (cause instanceof ApiError) {
    return cause;
  }

  if (isApiErrorResponse(cause)) {
    return apiErrorFromPayload(cause);
  }

  if (isBackendDetailErrorResponse(cause)) {
    return apiErrorFromBackendDetailPayload(cause);
  }

  if (cause instanceof Error) {
    return new ApiError({
      code: 'CLIENT_ERROR',
      message: cause.message || fallbackMessage,
      details: {},
    });
  }

  return new ApiError({
    code: 'UNKNOWN_ERROR',
    message: fallbackMessage,
    details: {},
  });
}

/** Atajo para mostrar en la UI un mensaje seguro y consistente. */
export function getApiErrorMessage(
  cause: unknown,
  fallbackMessage?: string,
): string {
  return normalizeApiError(cause, fallbackMessage).message;
}
