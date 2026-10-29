import { API_V1_URL } from "@/config/api";
import { authSession } from "@/services/auth-session";
import { demo } from "@/services/demo-store";
import { dataClient } from "@/services/data";
import {
  clearTokens,
  getRefreshToken,
  saveTokens,
} from "@/services/token-storage";
import type {
  AuthTokensResponse,
  CurrentUserResponse,
  RegisterRequest,
  UUID,
} from "@/types/api";
import { ApiError, apiErrorFromResponse, normalizeApiError } from "./errors";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type QueryValue = string | number | boolean | null | undefined;

export type QueryParams = Record<string, QueryValue>;

export type ApiRequestOptions = {
  query?: QueryParams;
  body?: unknown;
  headers?: HeadersInit;

  /**
   * Por defecto las solicitudes intentan
   * adjuntar Authorization.
   *
   * Login, registro, refresh, etc. usan:
   * auth: false
   */
  auth?: boolean;

  /**
   * Permite entregar un token explícitamente.
   */
  accessToken?: string | null;

  timeoutMs?: number;
  signal?: AbortSignal;
};

export type AccessTokenProvider = () =>
  | string
  | null
  | undefined
  | Promise<string | null | undefined>;

/*
 * Alias para mantener compatibilidad con
 * componentes agregados por Sebastián.
 */
export type AuthTokens = AuthTokensResponse;

export type AuthUser = CurrentUserResponse;

export type RegisterData = RegisterRequest;

export type RegisterResponse = CurrentUserResponse | Record<string, unknown>;

const DEFAULT_TIMEOUT_MS = 15_000;
const API_PREFIX = "/api/v1";

/*
 * Sebastián utilizaba API_BASE_URL para
 * representar la URL ya versionada.
 *
 * Conservamos el export para evitar romper
 * imports existentes.
 */
export const API_BASE_URL = API_V1_URL;

/*
 * Por defecto recuperamos el token desde
 * SecureStore/localStorage.
 *
 * auth-session podrá reemplazar este proveedor
 * mientras exista una sesión activa.
 */
let accessTokenProvider: AccessTokenProvider = () => authSession.accessToken();

export function setApiAccessTokenProvider(provider: AccessTokenProvider): void {
  accessTokenProvider = provider;
}

export function clearApiAccessTokenProvider(): void {
  accessTokenProvider = () => authSession.accessToken();
}

function createCorrelationId(): UUID {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);

      const value = character === "x" ? random : (random & 0x3) | 0x8;

      return value.toString(16);
    },
  );
}

function requireApiBaseUrl(): string {
  if (!API_V1_URL) {
    throw new ApiError({
      code: "API_NOT_CONFIGURED",

      message: "La URL del API Gateway no está configurada.",

      details: {
        variable: "EXPO_PUBLIC_API_URL",
      },
    });
  }

  return API_V1_URL;
}

/*
 * Se aceptan:
 *
 * /auth/login
 *
 * o:
 *
 * /api/v1/auth/login
 *
 * pero nunca una URL absoluta dirigida
 * directamente a un microservicio.
 */
function normalizePath(path: string): string {
  let trimmed = path.trim();

  if (!trimmed || trimmed === "/" || trimmed === API_PREFIX) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    throw new ApiError({
      code: "INVALID_API_PATH",

      message: "La ruta de la API debe ser relativa al API Gateway.",

      details: {
        path: trimmed,
      },
    });
  }

  if (!trimmed.startsWith("/")) {
    trimmed = `/${trimmed}`;
  }

  if (trimmed === API_PREFIX) {
    return "";
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
    .join("&");

  return `${url}?${search}`;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer;
}

function prepareBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (
    typeof body === "string" ||
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

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (!headers.has("X-Correlation-ID")) {
    headers.set("X-Correlation-ID", createCorrelationId());
  }

  if (
    body !== undefined &&
    body !== null &&
    !isFormData(body) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false && !headers.has("Authorization")) {
    const token = await resolveAccessToken(options.accessToken);

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
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

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError({
        code: "INVALID_API_RESPONSE",

        message: "El servidor devolvió una respuesta JSON inválida.",

        details: {
          status: response.status,
        },

        status: response.status,
      });
    }
  }

  return text as T;
}

/* El backend rota el refresh token: una sola renovación puede estar en vuelo. */
let pendingRefresh: Promise<string | null> | null = null;

export async function refreshAccessToken(failedAccessToken?: string | null): Promise<string | null> {
  if (authSession.mode() !== "backend" || !API_V1_URL) return null;

  // Otra solicitud ya renovó la sesión mientras esta recibía su respuesta 401.
  const currentAccessToken = authSession.accessToken();
  if (failedAccessToken && currentAccessToken && failedAccessToken !== currentAccessToken) {
    return currentAccessToken;
  }
  if (pendingRefresh) return pendingRefresh;

  const generation = authSession.generation();
  const action = (async (): Promise<string | null> => {
    const refreshToken = authSession.refreshToken() ?? await getRefreshToken();
    if (!refreshToken || authSession.generation() !== generation) return null;

    const response = await fetch(`${API_V1_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Correlation-ID": createCorrelationId(),
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (authSession.generation() !== generation) return null;
    if (response.status === 401) {
      // Token revocado/vencido. No conservar acceso local a una sesión inválida.
      authSession.clear();
      demo.logout();
      dataClient.clearCache();
      await clearTokens();
      return null;
    }
    // Una caída del Gateway NO debe borrar el refresh token válido.
    if (!response.ok) {
      throw await apiErrorFromResponse(response);
    }
    const tokens = await parseSuccessfulResponse<AuthTokensResponse>(response);
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      throw new ApiError({
        code: "INVALID_API_RESPONSE",
        message: "El servidor devolvió una renovación inválida.",
        details: {},
      });
    }
    if (authSession.generation() !== generation) return null;
    await saveTokens(tokens.accessToken, tokens.refreshToken);
    if (authSession.generation() !== generation) {
      await clearTokens();
      return null;
    }
    authSession.rotateBackendTokens(tokens);
    return tokens.accessToken;
  })();
  pendingRefresh = action;
  try { return await action; } finally { if (pendingRefresh === action) pendingRefresh = null; }
}

async function executeFetch(
  method: HttpMethod,
  path: string,
  options: ApiRequestOptions,
  signal: AbortSignal,
  accessTokenOverride?: string | null,
): Promise<Response> {
  const headers = await buildHeaders(options.body, {
    ...options,

    accessToken:
      accessTokenOverride !== undefined
        ? accessTokenOverride
        : options.accessToken,
  });

  return fetch(buildUrl(path, options.query), {
    method,

    headers,

    body: prepareBody(options.body),

    signal,
  });
}

/*
 * Cliente HTTP central.
 *
 * Mantiene:
 * - API Gateway;
 * - Bearer token;
 * - SecureStore;
 * - X-Correlation-ID;
 * - timeout;
 * - cancelación;
 * - ApiError;
 * - refresh automático ante 401.
 */
export async function apiRequest<T>(
  method: HttpMethod,
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const requestHeaders = new Headers(options.headers);
  if (!requestHeaders.get("X-Correlation-ID")?.trim()) {
    requestHeaders.set("X-Correlation-ID", createCorrelationId());
  }
  const requestCorrelationId = requestHeaders.get("X-Correlation-ID")!;
  const requestOptions = { ...options, headers: requestHeaders };
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
      options.signal.addEventListener("abort", abortFromExternalSignal, {
        once: true,
      });
    }
  }

  const requestGeneration = options.auth !== false && authSession.mode() === 'backend'
    ? authSession.generation()
    : null;

  try {
    // Capturamos el token del intento inicial para no renovar dos veces ante dos 401.
    const sentAccessToken = options.auth === false
      ? null
      : options.accessToken !== undefined
        ? options.accessToken
        : await resolveAccessToken(undefined);
    let response = await executeFetch(method, path, requestOptions, controller.signal, sentAccessToken);

    /*
     * Si expira el access token:
     * 1. renovamos;
     * 2. almacenamos tokens nuevos;
     * 3. repetimos una sola vez.
     */
    if (response.status === 401 && options.auth !== false && authSession.mode() === "backend") {
      const refreshedAccessToken = await refreshAccessToken(sentAccessToken);

      if (refreshedAccessToken) {
        response = await executeFetch(
          method,
          path,
          requestOptions,
          controller.signal,
          refreshedAccessToken,
        );
      }
    }

    if (!response.ok) {
      throw await apiErrorFromResponse(response, requestCorrelationId);
    }

    const result = await parseSuccessfulResponse<T>(response);
    if (requestGeneration !== null && authSession.generation() !== requestGeneration) {
      throw new ApiError({
        code: 'SESSION_CHANGED',
        message: 'Esta respuesta pertenece a una sesión anterior.',
        details: {},
      });
    }
    return result;
  } catch (cause) {
    if (cause instanceof ApiError) {
      throw cause;
    }

    if (cause instanceof Error && cause.name === "AbortError") {
      if (timedOut) {
        throw new ApiError({
          code: "REQUEST_TIMEOUT",
          correlationId: requestCorrelationId,

          message: "La solicitud tardó demasiado tiempo en responder.",

          details: {
            timeoutMs,
          },
        });
      }

      throw new ApiError({
        code: "REQUEST_CANCELLED",
        correlationId: requestCorrelationId,

        message: "La solicitud fue cancelada.",

        details: {},
      });
    }

    const normalized = normalizeApiError(
      cause,
      "No fue posible comunicarse con el servidor.",
    );

    throw new ApiError({
      code:
        normalized.code === "CLIENT_ERROR" ? "NETWORK_ERROR" : normalized.code,

      message:
        normalized.code === "CLIENT_ERROR"
          ? "No fue posible comunicarse con el servidor."
          : normalized.message,

      details: normalized.details,

      correlationId: requestCorrelationId,

      status: normalized.status,
    });
  } finally {
    clearTimeout(timeout);

    options.signal?.removeEventListener("abort", abortFromExternalSignal);
  }
}

/*
 * Cliente simplificado para que cada servicio
 * no tenga que repetir fetch.
 */
export const apiClient = {
  get: <T>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>("GET", path, options),

  post: <T>(path: string, body?: unknown, options: ApiRequestOptions = {}) =>
    apiRequest<T>("POST", path, {
      ...options,
      body,
    }),

  put: <T>(path: string, body?: unknown, options: ApiRequestOptions = {}) =>
    apiRequest<T>("PUT", path, {
      ...options,
      body,
    }),

  patch: <T>(path: string, body?: unknown, options: ApiRequestOptions = {}) =>
    apiRequest<T>("PATCH", path, {
      ...options,
      body,
    }),

  delete: <T>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>("DELETE", path, options),
};

/*
 * Registro real.
 *
 * Se conserva esta función porque
 * account-form.tsx de Sebastián ya la utiliza.
 */
export async function register(data: RegisterData): Promise<RegisterResponse> {
  return apiClient.post<RegisterResponse>(
    "/auth/register",

    {
      ...data,

      fullName: data.fullName.trim(),

      email: data.email.trim().toLowerCase(),
    },

    {
      auth: false,
    },
  );
}

/*
 * Login real.
 *
 * Además de retornar los tokens, los guarda
 * mediante SecureStore.
 */
export async function login(
  email: string,
  password: string,
): Promise<AuthTokensResponse> {
  const tokens = await apiClient.post<AuthTokensResponse>(
    "/auth/login",

    {
      email: email.trim().toLowerCase(),

      password,
    },

    {
      auth: false,
    },
  );

  if (!tokens?.accessToken || !tokens?.refreshToken) {
    throw new ApiError({
      code: "INVALID_API_RESPONSE",

      message: "El servidor devolvió una sesión inválida.",

      details: {},
    });
  }

  await saveTokens(tokens.accessToken, tokens.refreshToken);

  return tokens;
}

/*
 * Usuario real autenticado.
 */
export async function getMe(): Promise<CurrentUserResponse> {
  return apiClient.get<CurrentUserResponse>("/me");
}

/*
 * Compatibilidad con código previo de
 * Sebastián que pudiera requerir Response
 * directamente.
 */
export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${requireApiBaseUrl()}${normalizePath(endpoint)}`;

  let accessToken = authSession.accessToken();

  const headers = new Headers(options.headers ?? {});

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (!headers.has("Content-Type") && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("X-Correlation-ID")) {
    headers.set("X-Correlation-ID", createCorrelationId());
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status !== 401) {
    return response;
  }

  accessToken = await refreshAccessToken(accessToken);

  if (!accessToken) {
    return response;
  }

  headers.set("Authorization", `Bearer ${accessToken}`);

  response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}

/*
 * Cierre local de la sesión real.
 */
export async function logoutLocal(): Promise<void> {
  authSession.clear();
  await clearTokens();
}
