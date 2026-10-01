import { API_V1_URL } from '@/config/api';
import type { UUID } from '@/types/api';
import { ApiError, apiErrorFromResponse, normalizeApiError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export type ApiRequestOptions = {
  /** Parámetros que se agregan a la URL como ?clave=valor. */
  query?: QueryParams;

  /** Cuerpo enviado al backend. Los objetos normales se serializan como JSON. */
  body?: unknown;

  /** Headers adicionales para una solicitud específica. */
  headers?: HeadersInit;

  /**
   * Indica si se intentará adjuntar Authorization: Bearer <token>.
   * Por defecto es true. Login, registro, refresh, logout y health pueden usar auth: false.
   */
  auth?: boolean;

  /** Token explícito para esta solicitud. Si se omite, se consulta el proveedor global. */
  accessToken?: string | null;

  /** Tiempo máximo de espera de la solicitud. */
  timeoutMs?: number;

  /** Señal externa opcional para cancelar la solicitud. */
  signal?: AbortSignal;
};

export type AccessTokenProvider = () =>
  | string
  | null
  | undefined
  | Promise<string | null | undefined>;

const DEFAULT_TIMEOUT_MS = 15_000;
const API_PREFIX = '/api/v1';

let accessTokenProvider: AccessTokenProvider = () => null;

/**
 * Permite que el cliente HTTP obtenga el access token sin conocer cómo se almacena.
 * En la etapa de almacenamiento seguro este proveedor se conectará a expo-secure-store.
 */
export function setApiAccessTokenProvider(provider: AccessTokenProvider): void {
  accessTokenProvider = provider;
}

/** Restablece el cliente para que no utilice un token global. */
export function clearApiAccessTokenProvider(): void {
  accessTokenProvider = () => null;
}

function createCorrelationId(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function requireApiBaseUrl(): string {
  if (!API_V1_URL) {
    throw new ApiError({
      code: 'API_NOT_CONFIGURED',
      message: 'La URL del API Gateway no está configurada.',
      details: {
        variable: 'EXPO_PUBLIC_API_URL',
      },
    });
  }

  return API_V1_URL;
}

/**
 * El cliente acepta tanto rutas relativas a /api/v1 como rutas completas del contrato.
 *
 * Ejemplos equivalentes:
 *   /auth/login
 *   /api/v1/auth/login
 */
function normalizePath(path: string): string {
  let trimmed = path.trim();

  if (!trimmed || trimmed === '/' || trimmed === API_PREFIX) {
    return '';
  }

  // Impide que un servicio salte accidentalmente el API Gateway entregando una URL absoluta.
  if (/^https?:\/\//i.test(trimmed)) {
    throw new ApiError({
      code: 'INVALID_API_PATH',
      message: 'La ruta de la API debe ser relativa al API Gateway.',
      details: { path: trimmed },
    });
  }

  if (!trimmed.startsWith('/')) {
    trimmed = `/${trimmed}`;
  }

  if (trimmed === API_PREFIX) {
    return '';
  }

  if (trimmed.startsWith(`${API_PREFIX}/`)) {
    trimmed = trimmed.slice(API_PREFIX.length);
  }

  return trimmed;
}

function buildUrl(path: string, query?: QueryParams): string {
  const baseUrl = requireApiBaseUrl();
  const url = `${baseUrl}${normalizePath(path)}`;

  if (!query) {
    return url;
  }

  const entries = Object.entries(query).filter(
    ([, value]) => value !== undefined && value !== null,
  );

  if (entries.length === 0) {
    return url;
  }

  const search = entries
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join('&');

  return `${url}?${search}`;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer;
}

function prepareBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (
    typeof body === 'string' ||
    isFormData(body) ||
    isBlob(body) ||
    isArrayBuffer(body)
  ) {
    return body;
  }

  return JSON.stringify(body);
}

async function resolveAccessToken(
  explicitToken: string | null | undefined,
): Promise<string | null> {
  if (explicitToken !== undefined) {
    return explicitToken;
  }

  const provided = await accessTokenProvider();
  return provided ?? null;
}

async function buildHeaders(
  body: unknown,
  options: ApiRequestOptions,
): Promise<Headers> {
  const headers = new Headers(options.headers);

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (!headers.has('X-Correlation-ID')) {
    headers.set('X-Correlation-ID', createCorrelationId());
  }

  if (
    body !== undefined &&
    body !== null &&
    !isFormData(body) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth !== false && !headers.has('Authorization')) {
    const token = await resolveAccessToken(options.accessToken);

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  return headers;
}

async function parseSuccessfulResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();

  if (!text.trim()) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError({
        code: 'INVALID_API_RESPONSE',
        message: 'El servidor devolvió una respuesta JSON inválida.',
        details: { status: response.status },
        status: response.status,
      });
    }
  }

  return text as T;
}

/**
 * Punto central de las solicitudes HTTP de la aplicación hacia el API Gateway.
 *
 * Se encarga de:
 * - construir /api/v1/... a partir de EXPO_PUBLIC_API_URL;
 * - aceptar rutas relativas o rutas /api/v1/... del contrato;
 * - serializar JSON;
 * - adjuntar Bearer token cuando corresponda;
 * - agregar X-Correlation-ID;
 * - aplicar timeout;
 * - convertir errores HTTP al ApiError de la tarea 9.
 */
export async function apiRequest<T>(
  method: HttpMethod,
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const abortFromExternalSignal = () => controller.abort();

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', abortFromExternalSignal, {
        once: true,
      });
    }
  }

  try {
    const headers = await buildHeaders(options.body, options);

    const response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: prepareBody(options.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw await apiErrorFromResponse(response);
    }

    return await parseSuccessfulResponse<T>(response);
  } catch (cause) {
    if (cause instanceof ApiError) {
      throw cause;
    }

    if (cause instanceof Error && cause.name === 'AbortError') {
      if (timedOut) {
        throw new ApiError({
          code: 'REQUEST_TIMEOUT',
          message: 'La solicitud tardó demasiado tiempo en responder.',
          details: { timeoutMs },
        });
      }

      throw new ApiError({
        code: 'REQUEST_CANCELLED',
        message: 'La solicitud fue cancelada.',
        details: {},
      });
    }

    const normalized = normalizeApiError(
      cause,
      'No fue posible comunicarse con el servidor.',
    );

    throw new ApiError({
      code: normalized.code === 'CLIENT_ERROR' ? 'NETWORK_ERROR' : normalized.code,
      message:
        normalized.code === 'CLIENT_ERROR'
          ? 'No fue posible comunicarse con el servidor.'
          : normalized.message,
      details: normalized.details,
      correlationId: normalized.correlationId,
      status: normalized.status,
    });
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromExternalSignal);
  }
}

/** Cliente pequeño para evitar repetir método HTTP en cada servicio. */
export const apiClient = {
  get: <T>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>('GET', path, options),

  post: <T>(path: string, body?: unknown, options: ApiRequestOptions = {}) =>
    apiRequest<T>('POST', path, { ...options, body }),

  put: <T>(path: string, body?: unknown, options: ApiRequestOptions = {}) =>
    apiRequest<T>('PUT', path, { ...options, body }),

  patch: <T>(path: string, body?: unknown, options: ApiRequestOptions = {}) =>
    apiRequest<T>('PATCH', path, { ...options, body }),

  delete: <T>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>('DELETE', path, options),
};
