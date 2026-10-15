import type { HealthResponse } from '@/types/api';
import { dataClient } from './data';

/**
 * Operaciones públicas del API Gateway que pueden probarse antes de integrar la sesión real.
 */
export const gatewayService = {
  /**
   * Comprueba que Expo puede llegar al API Gateway y que este puede consultar sus servicios.
   * No requiere token. Usa una caché muy corta y reintentos acotados, pero no devuelve
   * una respuesta expirada si el Gateway dejó de responder.
   */
  health: () =>
    dataClient.get<HealthResponse>('/health', {
      auth: false,
      timeoutMs: 8_000,
      cache: {
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
