import { API_V1_URL } from "@/config/api";
import {
  clearTokens,
  getAccessToken,
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

  /**
   * Códigos HTTP no exitosos cuyo cuerpo sigue siendo una respuesta válida.
   *
   * Por ejemplo, el health check del Gateway responde 503 junto con el
   * detalle de los microservicios cuando el sistema está degradado.
   */
  acceptedStatuses?: readonly number[];
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

export type RegisterResponse = CurrentUserResponse;

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
let accessTokenProvider: AccessTokenProvider = () => getAccessToken();

export function setApiAccessTokenProvider(provider: AccessTokenProvider): void {
  accessTokenProvider = provider;
}

export function clearApiAccessTokenProvider(): void {
  accessTokenProvider = () => getAccessToken();
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

/*
 * Renovación del access token utilizando el
 * refresh token almacenado con SecureStore.
 */
let sessionRevision = 0;
let refreshFlight: { revision: number; promise: Promise<string | null> } | null = null;
let sessionHandlers = {
  refreshed: (_tokens: AuthTokensResponse) => {},
  expired: () => {},
};
export function setApiSessionHandlers(handlers: typeof sessionHandlers) { sessionHandlers = handlers; }
export function invalidateApiSession() { sessionRevision += 1; }
export function apiSessionRevision() { return sessionRevision; }

async function expireSession(revision: number) {
  if (revision !== sessionRevision) return;
  sessionHandlers.expired();
  await clearTokens();
}

export function refreshAccessToken(): Promise<string | null> {
  const revision = sessionRevision;
  if (refreshFlight?.revision === revision) return refreshFlight.promise;
  const promise = (async () => {
    const refreshToken = await getRefreshToken();
    if (revision !== sessionRevision) return null;
    if (!refreshToken || !API_V1_URL) {
      await expireSession(revision);
      return null;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_V1_URL}/auth/refresh`, {
        method: 'POST', signal: controller.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Correlation-ID': createCorrelationId() },
        body: JSON.stringify({ refreshToken }),
      });
      if (revision !== sessionRevision && !response.ok) return null;
      if (response.status === 401 || response.status === 403) {
        await expireSession(revision);
        return null;
      }
      if (!response.ok) throw await apiErrorFromResponse(response);
      const tokens = await parseSuccessfulResponse<AuthTokensResponse>(response);
      if (typeof tokens?.accessToken !== 'string' || !tokens.accessToken || typeof tokens?.refreshToken !== 'string' || !tokens.refreshToken) {
        throw new ApiError({ code: 'INVALID_API_RESPONSE', message: 'El servidor no pudo renovar la sesion.' });
      }
      if (revision !== sessionRevision) {
        // El servidor pudo rotar el token mientras se cerraba la sesion.
        await apiClient.post('/auth/logout', { refreshToken: tokens.refreshToken }, { auth: false }).catch(() => {});
        return null;
      }
      try {
        await saveTokens(tokens.accessToken, tokens.refreshToken);
      } catch (error) {
        await expireSession(revision);
        await apiClient.post('/auth/logout', { refreshToken: tokens.refreshToken }, { auth: false }).catch(() => {});
        throw error;
      }
      if (revision !== sessionRevision) {
        await apiClient.post('/auth/logout', { refreshToken: tokens.refreshToken }, { auth: false }).catch(() => {});
        return null;
      }
      sessionHandlers.refreshed(tokens);
      return tokens.accessToken;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError({ code: 'REQUEST_TIMEOUT', message: 'La renovación de sesión tardó demasiado. Intenta nuevamente.' });
      }
      throw error;
    } finally { clearTimeout(timer); }
  })();
  refreshFlight = { revision, promise };
  void promise.finally(() => {
    if (refreshFlight?.promise === promise) refreshFlight = null;
  }).catch(() => {});
  return promise;
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

  try {
    const revision = sessionRevision;
    const originalToken = options.auth === false ? null : await resolveAccessToken(options.accessToken);
    let response = await executeFetch(method, path, options, controller.signal, originalToken);

    /*
     * Si expira el access token:
     * 1. renovamos;
     * 2. almacenamos tokens nuevos;
     * 3. repetimos una sola vez.
     */
    if (response.status === 401 && options.auth !== false) {
      if (revision !== sessionRevision) throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesion cambio.' });
      const currentToken = await resolveAccessToken(undefined);
      const refreshedAccessToken = currentToken && currentToken !== originalToken
        ? currentToken : await refreshAccessToken();

      if (refreshedAccessToken) {
        response = await executeFetch(
          method,
          path,
          options,
          controller.signal,
          refreshedAccessToken,
        );
      }
    }

    if (options.auth !== false && revision !== sessionRevision) {
      throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesion cambio. Vuelve a ingresar.' });
    }
    if (response.status === 401 && options.auth !== false) await expireSession(revision);
    if (
      !response.ok &&
      !options.acceptedStatuses?.includes(response.status)
    ) {
      throw await apiErrorFromResponse(response);
    }

    const result = await parseSuccessfulResponse<T>(response);
    if (options.auth !== false && revision !== sessionRevision) {
      throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesión cambió. Vuelve a ingresar.' });
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

          message: "La solicitud tardó demasiado tiempo en responder.",

          details: {
            timeoutMs,
          },
        });
      }

      throw new ApiError({
        code: "REQUEST_CANCELLED",

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

      correlationId: normalized.correlationId,

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
  const user = await apiClient.post<RegisterResponse>(
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
  if (!user || typeof user.id !== 'string' || !user.id ||
      typeof user.fullName !== 'string' || typeof user.email !== 'string' ||
      !Array.isArray(user.roles) || !user.roles.includes(data.role)) {
    throw new ApiError({
      code: 'INVALID_API_RESPONSE',
      message: 'El servidor no confirmó correctamente la cuenta. Intenta iniciar sesión antes de registrarte nuevamente.',
    });
  }
  return user;
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
  const revision = sessionRevision;
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

  if (revision !== sessionRevision) {
    await apiClient.post('/auth/logout', { refreshToken: tokens.refreshToken }, { auth: false }).catch(() => {});
    throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesion cambio.' });
  }
  await saveTokens(tokens.accessToken, tokens.refreshToken);
  if (revision !== sessionRevision) {
    await apiClient.post('/auth/logout', { refreshToken: tokens.refreshToken }, { auth: false }).catch(() => {});
    throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesion cambio.' });
  }


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

  const revision = sessionRevision;
  let accessToken = await resolveAccessToken(undefined);
  const originalToken = accessToken;

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

  if (revision !== sessionRevision) throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesion cambio.' });
  if (response.status !== 401) {
    return response;
  }

  const currentToken = await resolveAccessToken(undefined);
  accessToken = currentToken && currentToken !== originalToken ? currentToken : await refreshAccessToken();

  if (!accessToken) {
    return response;
  }

  headers.set("Authorization", `Bearer ${accessToken}`);

  response = await fetch(url, {
    ...options,
    headers,
  });

  if (revision !== sessionRevision) throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesion cambio.' });
  if (response.status === 401) await expireSession(revision);
  return response;
}

/*
 * Cierre local de la sesión real.
 */
export async function logoutLocal(): Promise<void> {
  sessionHandlers.expired();
  await clearTokens();
}
