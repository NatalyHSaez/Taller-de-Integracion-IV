import type { ApiErrorResponse, UUID } from '@/types/api';

export type ApiErrorInit = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  correlationId?: UUID;
  status?: number;
};

/**
 * Error único utilizado para representar fallos provenientes de la API.
 *
 * Conserva el formato común acordado para el backend y, además, el status HTTP
 * cuando está disponible. De esta forma las pantallas no necesitan interpretar
 * distintas formas de error por separado.
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

  /** Devuelve el error con la misma forma JSON definida para la API. */
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

/** Comprueba en tiempo de ejecución si un JSON respeta el formato común de error. */
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

function fallbackCodeForStatus(status: number): string {
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
    case 422:
      return 'VALIDATION_ERROR';
    default:
      return status >= 500 ? 'SERVER_ERROR' : 'HTTP_ERROR';
  }
}

function fallbackMessageForStatus(status: number): string {
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
    case 422:
      return 'No fue posible validar los datos enviados.';
    default:
      return status >= 500
        ? 'El servidor no pudo completar la solicitud.'
        : `La solicitud falló con código HTTP ${status}.`;
  }
}

/** Convierte el JSON común de error en una instancia uniforme para el frontend. */
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
 * Convierte una respuesta HTTP fallida en ApiError.
 * No realiza ninguna solicitud: será reutilizado por el cliente HTTP de la tarea 10.
 */
export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (isApiErrorResponse(payload)) {
    return apiErrorFromPayload(payload, response.status);
  }

  return new ApiError({
    code: fallbackCodeForStatus(response.status),
    message: fallbackMessageForStatus(response.status),
    details: {},
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
