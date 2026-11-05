import type { HealthResponse } from '@/types/api';
import { dataClient } from './data';

type HealthRequestOptions = {
  forceRefresh?: boolean;
  signal?: AbortSignal;
};

/**
 * Operaciones públicas del API Gateway que pueden probarse antes de integrar la sesión real.
 */
export const gatewayService = {
  /**
   * Comprueba que Expo puede llegar al API Gateway y que este puede consultar sus servicios.
   * No requiere token. Usa una caché muy corta y reintentos acotados, pero no devuelve
   * una respuesta expirada si el Gateway dejó de responder.
   */
  health: ({ forceRefresh = false, signal }: HealthRequestOptions = {}) =>
    dataClient.get<HealthResponse>('/health', {
      auth: false,
      acceptedStatuses: [503],
      signal,
      timeoutMs: 8_000,
      cache: {
        forceRefresh,
        ttlMs: 5_000,
        staleIfErrorMs: 0,
      },
      retry: {
        attempts: 2,
        initialDelayMs: 300,
        maxDelayMs: 600,
      },
    }),
};
