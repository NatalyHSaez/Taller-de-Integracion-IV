import type { ApiRequestOptions, QueryParams } from '../api';
import { apiClient } from '../api';
import { authSession } from '../auth-session';
import { ApiError, normalizeApiError } from '../errors';
import { dataCache } from './cache';
import { isRetryableApiError, type RetryOptions, withRetry } from './retry';

export type CacheOptions = {
  /** TTL de los resultados válidos; no implica que el acceso siga autorizado. */
  ttlMs?: number;
  /** Opt-in explícito para datos NO sensibles. Predeterminado 0 para datos clínicos. */
  staleIfErrorMs?: number;
  /** Omite caché fresca y consultas en curso que no solicitaron actualización. */
  forceRefresh?: boolean;
  /** Distintivo adicional: nunca reemplaza la ruta y filtros en la clave. */
  key?: string;
};

export type DataGetOptions = ApiRequestOptions & {
  cache?: CacheOptions | false;
  retry?: Partial<RetryOptions> | false;
};

const DEFAULT_CACHE_TTL_MS = 30_000;
const inFlight = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;
let requestSequence = 0;
const newestRequest = new Map<string, number>();

function normalizedQuery(query?: QueryParams): string {
  if (!query) return '';
  return Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

function pathKey(path: string, query?: QueryParams): string {
  const queryString = normalizedQuery(query);
  return queryString ? `GET:${path}?${queryString}` : `GET:${path}`;
}

function sessionScope(): string {
  // La rotación de tokens no cambia la generación; un nuevo login o logout sí.
  return `${authSession.generation()}:${authSession.mode() ?? 'guest'}:${authSession.user()?.id ?? '-'}`;
}

function changedError(): ApiError {
  return new ApiError({ code: 'SESSION_CHANGED',
    message: 'La sesión cambió durante la consulta. Vuelve a solicitar los datos.', details: {} });
}

function isCurrent(scope: string, generation: number): boolean {
  return scope === sessionScope() && generation === cacheGeneration;
}

function invalidatePending(): void {
  // Una petición anterior no puede escribir en la caché tras una invalidación.
  cacheGeneration += 1;
  inFlight.clear();
  newestRequest.clear();
}

/**
 * GET aislados por sesión, ruta y query. Los mocks nunca pasan por esta capa.
 * Las mutaciones siguen usando apiClient (sin reintentos automáticos).
 */
export const dataClient = {
  async get<T>(path: string, options: DataGetOptions = {}): Promise<T> {
    const { cache = {}, retry = {}, ...requestOptions } = options;
    const cacheEnabled = cache !== false;
    const cacheOptions = cache === false ? {} : cache;
    const retryEnabled = retry !== false;
    const retryOptions = retry === false ? {} : retry;
    const scope = sessionScope();
    const generation = cacheGeneration;
    const route = pathKey(path, requestOptions.query);
    // Una clave manual nunca omite patientId ni filtros de la ruta efectiva.
    const key = `${scope}::${route}::${cacheOptions.key ?? ''}`;

    if (cacheEnabled && !cacheOptions.forceRefresh) {
      const cached = dataCache.getFresh<T>(key);
      if (cached.hit) return cached.value as T;
    }

    // No compartir AbortSignal entre pantallas; tampoco GET sin caché.
    const deduplicate = cacheEnabled && !requestOptions.signal;
    const pendingKey = `${key}::${cacheOptions.forceRefresh ? 'refresh' : 'regular'}`;
    if (deduplicate) {
      const existing = inFlight.get(pendingKey) as Promise<T> | undefined;
      if (existing) return existing;
    }

    // Si se inicia un forceRefresh mientras había otra solicitud, solo el
    // resultado más reciente puede poblar la caché.
    const requestId = ++requestSequence;
    if (cacheEnabled) newestRequest.set(key, requestId);

    const request = (async (): Promise<T> => {
      try {
        const execute = () => apiClient.get<T>(path, requestOptions);
        const value = retryEnabled
          ? await withRetry(execute, retryOptions, requestOptions.signal)
          : await execute();
        if (!isCurrent(scope, generation)) throw changedError();
        if (cacheEnabled && newestRequest.get(key) === requestId) {
          dataCache.set(key, value, cacheOptions.ttlMs ?? DEFAULT_CACHE_TTL_MS);
        }
        return value;
      } catch (cause) {
        if (!isCurrent(scope, generation)) throw changedError();
        const error = normalizeApiError(cause);
        const staleIfErrorMs = cacheOptions.staleIfErrorMs ?? 0;
        // Nunca recuperar una copia tras una denegación/validación; stale es opt-in.
        if (cacheEnabled && staleIfErrorMs > 0 && isRetryableApiError(error)) {
          const stale = dataCache.getStale<T>(key, staleIfErrorMs);
          if (stale.hit) return stale.value as T;
        }
        if (!isRetryableApiError(error)) dataCache.delete(key);
        throw error;
      } finally {
        if (deduplicate && isCurrent(scope, generation)) {
          inFlight.delete(pendingKey);
        }
      }
    })();
    if (deduplicate) inFlight.set(pendingKey, request);
    return request;
  },

  /** Invalida variantes de la misma ruta+query en la sesión activa. */
  invalidate(path: string, query?: QueryParams): void {
    const prefix = `${sessionScope()}::${pathKey(path, query)}::`;
    invalidatePending();
    dataCache.deleteMatching((key) => key.startsWith(prefix));
  },

  /** Invalida todas las páginas y filtros de una misma ruta tras una mutación. */
  invalidatePath(path: string): void {
    const route = `${sessionScope()}::GET:${path}`;
    invalidatePending();
    dataCache.deleteMatching((key) => key.startsWith(`${route}?`) || key.startsWith(`${route}::`));
  },

  /** Invalida las lecturas clínicas de un paciente después de una mutación. */
  invalidatePatient(patientId: string): void {
    const prefix = `${sessionScope()}::GET:/patients/${encodeURIComponent(patientId)}`;
    invalidatePending();
    dataCache.deleteMatching((key) =>
      key.startsWith(`${prefix}/`) || key.startsWith(`${prefix}?`) || key.startsWith(`${prefix}::`));
  },

  /** Invalidación global ante login/logout, revocación de vínculos o cambio de paciente. */
  clearCache(): void {
    invalidatePending();
    dataCache.clear();
  },

  cacheSize(): number {
    return dataCache.size();
  },
};
