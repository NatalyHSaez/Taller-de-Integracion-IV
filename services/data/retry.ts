import { ApiError, normalizeApiError } from '../errors';

export type RetryOptions = {
  /** Número total de intentos, incluyendo el primero. */
  attempts: number;

  /** Espera inicial antes del segundo intento. */
  initialDelayMs: number;

  /** Límite máximo de espera entre intentos. */
  maxDelayMs: number;

  /** Multiplicador aplicado después de cada fallo transitorio. */
  backoffFactor: number;
};

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  attempts: 3,
  initialDelayMs: 400,
  maxDelayMs: 2_000,
  backoffFactor: 2,
};

/**
 * Solo se reintentan errores que razonablemente pueden resolverse al repetir
 * una lectura. Errores de autenticación, permisos, validación o 4xx normales
 * no se reintentan.
 */
export function isRetryableApiError(error: ApiError): boolean {
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

function cancelledError(): ApiError {
  return new ApiError({
    code: 'REQUEST_CANCELLED',
    message: 'La solicitud fue cancelada.',
    details: {},
  });
}

function wait(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  if (signal?.aborted) {
    return Promise.reject(cancelledError());
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      reject(cancelledError());
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  signal?: AbortSignal,
): Promise<T> {
  const config: RetryOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  const attempts = Math.max(1, Math.floor(config.attempts));
  let delayMs = Math.max(0, config.initialDelayMs);
  let lastError: ApiError | undefined;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (signal?.aborted) {
      throw cancelledError();
    }

    try {
      return await operation();
    } catch (cause) {
      const error = normalizeApiError(cause);
      lastError = error;

      const canRetry = attempt < attempts && isRetryableApiError(error);
      if (!canRetry) {
        throw error;
      }

      await wait(delayMs, signal);
      delayMs = Math.min(
        Math.max(0, Math.round(delayMs * config.backoffFactor)),
        Math.max(0, config.maxDelayMs),
      );
    }
  }

  throw lastError ?? normalizeApiError(undefined);
}
