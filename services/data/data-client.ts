import type { ApiRequestOptions, QueryParams } from '../api';
import { apiClient } from '../api';
import { normalizeApiError } from '../errors';
import { dataCache } from './cache';
import { type RetryOptions, withRetry } from './retry';

export type CacheOptions = {
  /** Tiempo durante el cual una respuesta se considera fresca. */
  ttlMs?: number;

  /**
   * Permite devolver la última copia expirada cuando falla una lectura por un
   * problema transitorio. No se usa frente a 401, 403, 404, 422, etc.
   */
  staleIfErrorMs?: number;

  /** Fuerza una lectura de red aunque exista una entrada fresca. */
  forceRefresh?: boolean;

  /** Clave manual para casos especiales. */
  key?: string;
};

export type DataGetOptions = ApiRequestOptions & {
  cache?: CacheOptions | false;
  retry?: Partial<RetryOptions> | false;
};

const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_STALE_IF_ERROR_MS = 5 * 60_000;

/** Evita duplicar llamadas iguales que ocurren al mismo tiempo. */
const inFlight = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;

function normalizedQuery(query?: QueryParams): string {
  if (!query) return '';

  return Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join('&');
}

function defaultCacheKey(path: string, query?: QueryParams): string {
  const queryString = normalizedQuery(query);
  return queryString ? `GET:${path}?${queryString}` : `GET:${path}`;
}

function isTransientFailure(error: ReturnType<typeof normalizeApiError>): boolean {
  if (error.status === 429 || (error.status !== undefined && error.status >= 500)) {
    return true;
  }

  return [
    'NETWORK_ERROR',
    'REQUEST_TIMEOUT',
    'SERVICE_UNAVAILABLE',
    'SERVER_ERROR',
    'TOO_MANY_REQUESTS',
  ].includes(error.code);
}

/**
 * Capa de datos para lecturas de API.
 *
 * Añade sobre apiClient:
 * - caché temporal en memoria;
 * - reutilización de una misma promesa para peticiones simultáneas;
 * - reintentos con backoff para fallos transitorios;
 * - uso opcional de una copia expirada si la red falla.
 *
 * Las mutaciones (POST/PATCH/DELETE) permanecen en apiClient y no se reintentan
 * automáticamente para evitar duplicar operaciones con efectos secundarios.
 */
export const dataClient = {
  async get<T>(path: string, options: DataGetOptions = {}): Promise<T> {
    const {
      cache = {},
      retry = {},
      ...requestOptions
    } = options;

    const cacheEnabled = cache !== false;
    const cacheOptions = cache === false ? {} : cache;
    const retryEnabled = retry !== false;
    const retryOptions = retry === false ? {} : retry;

    const key =
      cacheOptions.key ?? defaultCacheKey(path, requestOptions.query);

    if (cacheEnabled && !cacheOptions.forceRefresh) {
      const cached = dataCache.getFresh<T>(key);
      if (cached.hit) {
        return cached.value as T;
      }
    }

    const existing = inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const generation = cacheGeneration;

    const request = (async () => {
      try {
        const execute = () => apiClient.get<T>(path, requestOptions);
        const value = retryEnabled
          ? await withRetry(execute, retryOptions, requestOptions.signal)
          : await execute();

        if (cacheEnabled && generation === cacheGeneration) {
          dataCache.set(
            key,
            value,
            cacheOptions.ttlMs ?? DEFAULT_CACHE_TTL_MS,
          );
        }

        return value;
      } catch (cause) {
        const error = normalizeApiError(cause);
        const staleIfErrorMs =
          cacheOptions.staleIfErrorMs ?? DEFAULT_STALE_IF_ERROR_MS;

        if (cacheEnabled && staleIfErrorMs > 0 && isTransientFailure(error)) {
          const stale = dataCache.getStale<T>(key, staleIfErrorMs);

          if (stale.hit) {
            if (__DEV__) {
              console.warn(
                `[data] usando caché expirada para ${path} después de un error transitorio`,
                error.code,
              );
            }

            return stale.value as T;
          }
        }

        throw error;
      } finally {
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, request);
    return request;
  },

  /** Elimina una entrada concreta. */
  invalidate(path: string, query?: QueryParams): void {
    dataCache.delete(defaultCacheKey(path, query));
  },

  /** Vacía todas las respuestas cacheadas, por ejemplo al cambiar de sesión. */
  clearCache(): void {
    cacheGeneration += 1;
    dataCache.clear();
    inFlight.clear();
  },

  /** Útil para diagnóstico durante desarrollo. */
  cacheSize(): number {
    return dataCache.size();
  },
};
