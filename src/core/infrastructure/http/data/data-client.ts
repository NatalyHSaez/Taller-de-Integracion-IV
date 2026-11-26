import type { ApiRequestOptions, QueryParams } from '../api-client';
import { apiClient, apiSessionRevision } from '../api-client';
import { ApiError, normalizeApiError } from '../errors';
import { dataCache } from './cache';
import { isRetryableApiError, type RetryOptions, withRetry } from './retry';

export type CacheOptions = {
  /** TTL de resultados válidos; no equivale a autorización persistente. */
  ttlMs?: number;
  /** Solo para datos no sensibles, mediante opt-in explícito. */
  staleIfErrorMs?: number;
  /** Obliga a consultar servidor, sin reutilizar una lectura en curso ordinaria. */
  forceRefresh?: boolean;
  /** Distintivo adicional: nunca omite la ruta ni la consulta. */
  key?: string;
};

export type DataGetOptions = ApiRequestOptions & {
  cache?: CacheOptions | false;
  retry?: Partial<RetryOptions> | false;
};

const DEFAULT_CACHE_TTL_MS = 30_000;
const inFlight = new Map<string, Promise<unknown>>();
const newestRequest = new Map<string, number>();
// Permite invalidar claves con filtros sin depender de nuevas funciones de cache.ts.
const trackedCacheKeys = new Set<string>();
let cacheGeneration = 0;
let requestSequence = 0;

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
  // La revisión HTTP cambia al iniciar/cerrar una sesión real o simulada,
  // pero no durante un refresh de tokens de la misma sesión.
  // Evita importar application desde infrastructure (arquitectura limpia).
  return String(apiSessionRevision());
}

function sessionChanged(): ApiError {
  return new ApiError({
    code: 'SESSION_CHANGED',
    message: 'La sesión cambió durante la consulta. Solicita los datos nuevamente.',
    details: {},
  });
}

function isCurrent(scope: string, generation: number): boolean {
  return scope === sessionScope() && generation === cacheGeneration;
}

function invalidatePending(): void {
  cacheGeneration += 1;
  inFlight.clear();
  newestRequest.clear();
}

function deleteTracked(predicate: (key: string) => boolean): void {
  for (const key of trackedCacheKeys) {
    if (predicate(key)) {
      dataCache.delete(key);
      trackedCacheKeys.delete(key);
    }
  }
}

/**
 * Lecturas GET aisladas por sesión, ruta y parámetros.
 * Las mutaciones deben hacerse con apiClient para evitar reintentos duplicados.
 */
export const dataClient = {
  async get<T>(path: string, options: DataGetOptions = {}): Promise<T> {
    const { cache = {}, retry = {}, ...requestOptions } = options;
    const cacheEnabled = cache !== false && requestOptions.accessToken === undefined;
    const cacheOptions = cache === false ? {} : cache;
    const retryEnabled = retry !== false;
    const retryOptions = retry === false ? {} : retry;
    const scope = sessionScope();
    const generation = cacheGeneration;
    const route = pathKey(path, requestOptions.query);
    const key = `${scope}::${route}::${cacheOptions.key ?? ''}`;

    if (cacheEnabled && !cacheOptions.forceRefresh) {
      const cached = dataCache.getFresh<T>(key);
      if (cached.hit) return cached.value as T;
    }

    // AbortSignal es propio de cada pantalla: no compartir solicitudes cancelables.
    const deduplicate = cacheEnabled && !requestOptions.signal;
    const pendingKey = `${key}::${cacheOptions.forceRefresh ? 'refresh' : 'regular'}`;
    if (deduplicate) {
      const existing = inFlight.get(pendingKey) as Promise<T> | undefined;
      if (existing) return existing;
    }

    const requestId = ++requestSequence;
    if (cacheEnabled) newestRequest.set(key, requestId);

    let request!: Promise<T>;
    request = (async (): Promise<T> => {
      try {
        const execute = () => apiClient.get<T>(path, requestOptions);
        const value = retryEnabled
          ? await withRetry(execute, retryOptions, requestOptions.signal)
          : await execute();
        if (!isCurrent(scope, generation)) throw sessionChanged();
        if (cacheEnabled && newestRequest.get(key) === requestId) {
          dataCache.set(key, value, cacheOptions.ttlMs ?? DEFAULT_CACHE_TTL_MS);
          trackedCacheKeys.add(key);
        }
        return value;
      } catch (cause) {
        if (!isCurrent(scope, generation)) throw sessionChanged();
        const error = normalizeApiError(cause);
        const staleIfErrorMs = cacheOptions.staleIfErrorMs ?? 0;
        // Nunca entregar datos expirados por defecto, especialmente datos clínicos.
        if (cacheEnabled && staleIfErrorMs > 0 && isRetryableApiError(error)) {
          const stale = dataCache.getStale<T>(key, staleIfErrorMs);
          if (stale.hit) return stale.value as T;
        }
        if (!isRetryableApiError(error)) {
          dataCache.delete(key);
          trackedCacheKeys.delete(key);
        }
        throw error;
      } finally {
        if (deduplicate && inFlight.get(pendingKey) === request) {
          inFlight.delete(pendingKey);
        }
      }
    })();
    if (deduplicate) inFlight.set(pendingKey, request);
    return request;
  },

  /** Invalida todas las variantes de una consulta, incluso con key personalizada. */
  invalidate(path: string, query?: QueryParams): void {
    const prefix = `${sessionScope()}::${pathKey(path, query)}::`;
    invalidatePending();
    deleteTracked((key) => key.startsWith(prefix));
  },

  /** Invalida todas las páginas o filtros de una ruta modificada. */
  invalidatePath(path: string): void {
    const prefix = `${sessionScope()}::GET:${path}`;
    invalidatePending();
    deleteTracked((key) => key.startsWith(`${prefix}?`) || key.startsWith(`${prefix}::`));
  },

  /** Invalida datos de un paciente después de modificar sus relaciones o mediciones. */
  invalidatePatient(patientId: string): void {
    const prefix = `${sessionScope()}::GET:/patients/${encodeURIComponent(patientId)}`;
    invalidatePending();
    deleteTracked((key) => key.startsWith(`${prefix}/`) ||
      key.startsWith(`${prefix}?`) || key.startsWith(`${prefix}::`));
  },

  /** Borra la caché y evita que consultas anteriores la repueblen. */
  clearCache(): void {
    invalidatePending();
    dataCache.clear();
    trackedCacheKeys.clear();
  },

  cacheSize(): number {
    return dataCache.size();
  },
};
