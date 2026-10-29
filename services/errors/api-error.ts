import type {
  ApiErrorResponse,
  ApiValidationError,
  LocalApiErrorResponse,
} from '@/types/api/error';

export type ApiErrorInit = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  correlationId?: string;
  status?: number;
};

type BackendDetailErrorResponse = {
  detail: unknown;
  errorCode?: unknown;
  /** Compatibilidad con versiones anteriores; el backend actual usa errorCode. */
  codigo_error?: unknown;
};

/** Representación única de errores HTTP, de red y de los mocks. */
export class ApiError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly correlationId: string;
  readonly status?: number;

  constructor({ code, message, details = {}, correlationId, status }: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.correlationId = correlationId?.trim() || createClientCorrelationId();
    this.status = status;
  }

  /** Mantiene la forma local usada por los mocks, separada del contrato HTTP. */
  toResponse(): LocalApiErrorResponse {
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

function createClientCorrelationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function isValidationError(value: unknown): value is ApiValidationError {
  return isRecord(value) && Array.isArray(value.loc) &&
    value.loc.every((part) => typeof part === 'string' || typeof part === 'number') &&
    typeof value.msg === 'string' && typeof value.type === 'string';
}

/** Comprueba el contrato HTTP actual, no la serialización local de ApiError. */
export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return isRecord(value) &&
    (value.errorCode === undefined || typeof value.errorCode === 'string') &&
    (typeof value.detail === 'string' ||
      (Array.isArray(value.detail) && value.detail.every(isValidationError)));
}

export function isLocalApiErrorResponse(value: unknown): value is LocalApiErrorResponse {
  if (!isRecord(value) || !isRecord(value.error)) return false;
  const error = value.error;
  return typeof error.code === 'string' && typeof error.message === 'string' &&
    isRecord(error.details) && typeof error.correlationId === 'string';
}

function isBackendDetailErrorResponse(value: unknown): value is BackendDetailErrorResponse {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'detail');
}

function fallbackCodeForStatus(status?: number): string {
  switch (status) {
    case 400: return 'INVALID_REQUEST';
    case 401: return 'AUTHENTICATION_REQUIRED';
    case 403: return 'PERMISSION_DENIED';
    case 404: return 'RESOURCE_NOT_FOUND';
    case 408: return 'REQUEST_TIMEOUT';
    case 409: return 'CONFLICT';
    case 410: return 'RESOURCE_GONE';
    case 422: return 'VALIDATION_ERROR';
    case 429: return 'TOO_MANY_REQUESTS';
    case 503: return 'SERVICE_UNAVAILABLE';
    default:
      if (status !== undefined && status >= 500) return 'SERVER_ERROR';
      return status === undefined ? 'API_ERROR' : 'HTTP_ERROR';
  }
}

function fallbackMessageForStatus(status?: number): string {
  switch (status) {
    case 400: return 'La solicitud contiene datos inválidos.';
    case 401: return 'Debes iniciar sesión para continuar.';
    case 403: return 'No tienes permiso para realizar esta operación.';
    case 404: return 'El recurso solicitado no existe.';
    case 408: return 'La solicitud tardó demasiado tiempo en responder.';
    case 409: return 'La operación entra en conflicto con el estado actual.';
    case 410: return 'El recurso solicitado ya no se encuentra disponible.';
    case 422: return 'No fue posible validar los datos enviados. Revisa los campos e intenta nuevamente.';
    case 429: return 'Se realizaron demasiados intentos. Intenta nuevamente más tarde.';
    case 503: return 'El servicio no se encuentra disponible temporalmente.';
    default:
      if (status !== undefined && status >= 500) return 'El servidor no pudo completar la solicitud.';
      return 'Ocurrió un error al procesar la solicitud.';
  }
}

function apiErrorFromBackendDetailPayload(
  payload: BackendDetailErrorResponse,
  status?: number,
  correlationId?: string,
): ApiError {
  const validation = Array.isArray(payload.detail);
  const code = nonEmptyString(payload.errorCode) ?? nonEmptyString(payload.codigo_error) ??
    (validation ? 'VALIDATION_ERROR' : fallbackCodeForStatus(status));

  // No guardar input, ctx ni otros datos enviados por el usuario (p. ej. contraseñas).
  const details = validation ? {
    validation: (payload.detail as unknown[]).filter(isValidationError).map(({ loc, msg, type }) => ({
      loc: [...loc], msg, type,
    })),
  } : {};

  return new ApiError({
    code,
    message: validation
      ? fallbackMessageForStatus(422)
      : nonEmptyString(payload.detail) ?? fallbackMessageForStatus(status),
    details,
    correlationId,
    status,
  });
}

/** Acepta el contrato actual y la serialización local anterior. */
export function apiErrorFromPayload(
  payload: ApiErrorResponse | LocalApiErrorResponse,
  status?: number,
  correlationId?: string,
): ApiError {
  if ('detail' in payload) {
    return apiErrorFromBackendDetailPayload(payload, status, correlationId);
  }
  return new ApiError({
    ...payload.error,
    correlationId: correlationId ?? payload.error.correlationId,
    status,
  });
}

/**
 * La cabecera de respuesta tiene prioridad. Si no existe, conserva el ID enviado
 * por el cliente. Un HTML, JSON malformado o cuerpo vacío recibe un mensaje HTTP.
 */
export async function apiErrorFromResponse(
  response: Response,
  requestCorrelationId?: string,
): Promise<ApiError> {
  const responseCorrelationId = nonEmptyString(response.headers.get('x-correlation-id'));
  let payload: unknown;
  try {
    const text = await response.text();
    payload = text.trim() ? JSON.parse(text) : undefined;
  } catch {
    // Un error HTTP no deja de serlo si el proxy devuelve texto/HTML o falla la lectura.
  }

  if (isBackendDetailErrorResponse(payload)) {
    return apiErrorFromBackendDetailPayload(
      payload, response.status, responseCorrelationId ?? requestCorrelationId,
    );
  }
  if (isLocalApiErrorResponse(payload)) {
    return apiErrorFromPayload(
      payload, response.status,
      responseCorrelationId ?? nonEmptyString(payload.error.correlationId) ?? requestCorrelationId,
    );
  }
  return new ApiError({
    code: fallbackCodeForStatus(response.status),
    message: fallbackMessageForStatus(response.status),
    correlationId: responseCorrelationId ?? requestCorrelationId,
    status: response.status,
  });
}

/** Normaliza errores sin exigir que cada pantalla conozca el JSON del backend. */
export function normalizeApiError(
  cause: unknown,
  fallbackMessage = 'Ocurrió un error inesperado.',
): ApiError {
  if (cause instanceof ApiError) return cause;
  if (isBackendDetailErrorResponse(cause)) return apiErrorFromBackendDetailPayload(cause);
  if (isLocalApiErrorResponse(cause)) return apiErrorFromPayload(cause);
  if (cause instanceof Error) {
    return new ApiError({ code: 'CLIENT_ERROR', message: cause.message || fallbackMessage });
  }
  return new ApiError({ code: 'UNKNOWN_ERROR', message: fallbackMessage });
}

/** La UI recibe texto legible; las decisiones funcionales deben usar error.code. */
export function getApiErrorMessage(cause: unknown, fallbackMessage?: string): string {
  return normalizeApiError(cause, fallbackMessage).message;
}
