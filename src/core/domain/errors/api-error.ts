import type { UUID } from '../contracts/common';
import type { ApiErrorResponse, ClientApiErrorResponse } from '../contracts/error';

export type ApiErrorInit = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  correlationId?: UUID;
  status?: number;
};

type BackendDetailErrorResponse = {
  detail: unknown;
  errorCode?: unknown;
  /** Alias de una versión anterior del backend. */
  codigo_error?: unknown;
};

type ValidationItem = { loc: (string | number)[]; msg: string; type: string };

/** Error único de HTTP, red y mocks. */
export class ApiError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly correlationId: UUID;
  readonly status?: number;

  constructor({ code, message, details = {}, correlationId, status }: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.correlationId = correlationId?.trim() || createClientCorrelationId();
    this.status = status;
  }

  /** Representación interna; no es el JSON de errores HTTP del backend. */
  toResponse(): ClientApiErrorResponse {
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
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function isValidationItem(value: unknown): value is ValidationItem {
  return isRecord(value) && Array.isArray(value.loc) &&
    value.loc.every((part) => typeof part === 'string' || typeof part === 'number') &&
    typeof value.msg === 'string' && typeof value.type === 'string';
}

/** Contrato HTTP con FastAPI: { detail, errorCode? }. */
export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return isRecord(value) &&
    (value.errorCode === undefined || typeof value.errorCode === 'string') &&
    (typeof value.detail === 'string' ||
      (Array.isArray(value.detail) && value.detail.every(isValidationItem)));
}

export function isClientApiErrorResponse(value: unknown): value is ClientApiErrorResponse {
  if (!isRecord(value) || !isRecord(value.error)) return false;
  const error = value.error;
  return typeof error.code === 'string' && typeof error.message === 'string' &&
    isRecord(error.details) && typeof error.correlationId === 'string';
}

/** Alias para código que todavía denomina 'local' a la forma interna. */
export const isLocalApiErrorResponse = isClientApiErrorResponse;

export function isBackendDetailPayload(value: unknown): value is BackendDetailErrorResponse {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'detail');
}

export function fallbackCodeForStatus(status?: number): string {
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
      return status !== undefined && status >= 500 ? 'SERVER_ERROR'
        : status === undefined ? 'API_ERROR' : 'HTTP_ERROR';
  }
}

export function fallbackMessageForStatus(status?: number): string {
  switch (status) {
    case 400: return 'La solicitud contiene datos inválidos.';
    case 401: return 'Debes iniciar sesión para continuar.';
    case 403: return 'No posee permiso para realizar esta operación.';
    case 404: return 'El recurso solicitado no existe.';
    case 408: return 'La solicitud tardó demasiado tiempo en responder.';
    case 409: return 'La operación entra en conflicto con el estado actual.';
    case 410: return 'El recurso solicitado ya no se encuentra disponible.';
    case 422: return 'No fue posible validar los datos enviados.';
    case 429: return 'Se realizaron demasiados intentos. Intenta nuevamente más tarde.';
    case 503: return 'El servicio no se encuentra disponible temporalmente.';
    default:
      return status !== undefined && status >= 500
        ? 'El servidor no pudo completar la solicitud.'
        : status === undefined
          ? 'Ocurrió un error al procesar la solicitud.'
          : `La solicitud falló con código HTTP ${status}.`;
  }
}

export function apiErrorFromBackendDetailPayload(
  payload: BackendDetailErrorResponse,
  status?: number,
  correlationId?: UUID,
): ApiError {
  const validationDetails = Array.isArray(payload.detail) ? payload.detail : null;
  const validation = validationDetails !== null;
  const code = nonEmptyString(payload.errorCode) ?? nonEmptyString(payload.codigo_error) ??
    (validation ? 'VALIDATION_ERROR' : fallbackCodeForStatus(status));
  // No propagar input ni ctx de FastAPI, que pueden contener datos sensibles.
  const details: Record<string, unknown> = validation
    ? {
        validation: (validationDetails ?? [])
          .filter(isValidationItem)
          .map(({ loc, msg, type }) => ({ loc: [...loc], msg, type })),
      }
    : {};
  const detailMessage = isRecord(payload.detail)
    ? nonEmptyString(payload.detail.message)
    : nonEmptyString(payload.detail);
  return new ApiError({
    code,
    message: validation ? fallbackMessageForStatus(status ?? 422)
      : detailMessage ?? fallbackMessageForStatus(status),
    details,
    correlationId,
    status,
  });
}

export function apiErrorFromClientPayload(
  payload: ClientApiErrorResponse,
  status?: number,
  correlationId?: UUID,
): ApiError {
  return new ApiError({
    code: payload.error.code,
    message: payload.error.message,
    details: payload.error.details,
    correlationId: correlationId ?? payload.error.correlationId,
    status,
  });
}

/** Acepta tanto el contrato HTTP como la forma local usada en los mocks. */
export function apiErrorFromPayload(
  payload: ApiErrorResponse | ClientApiErrorResponse,
  status?: number,
  correlationId?: UUID,
): ApiError {
  if ('detail' in payload) {
    return apiErrorFromBackendDetailPayload(payload, status, correlationId);
  }
  return apiErrorFromClientPayload(payload, status, correlationId);
}

/** Recibe errores desconocidos de JS, respuestas del backend o mocks. */
export function normalizeApiError(
  cause: unknown,
  fallbackMessage = 'Ocurrió un error inesperado.',
): ApiError {
  if (cause instanceof ApiError) return cause;
  if (isClientApiErrorResponse(cause)) return apiErrorFromClientPayload(cause);
  if (isBackendDetailPayload(cause)) return apiErrorFromBackendDetailPayload(cause);
  if (cause instanceof Error) {
    return new ApiError({ code: 'CLIENT_ERROR', message: cause.message || fallbackMessage });
  }
  return new ApiError({ code: 'UNKNOWN_ERROR', message: fallbackMessage });
}

/** Mensaje legible para UI; lógica funcional debe usar error.code. */
export function getApiErrorMessage(cause: unknown, fallbackMessage?: string): string {
  return normalizeApiError(cause, fallbackMessage).message;
}
