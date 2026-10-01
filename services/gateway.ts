import type { HealthResponse } from '@/types/api';
import { apiClient } from './api';

/**
 * Operaciones públicas del API Gateway que pueden probarse antes de integrar la sesión real.
 */
export const gatewayService = {
  /**
   * Comprueba que Expo puede llegar al API Gateway y que este puede consultar sus servicios.
   * No requiere token.
   */
  health: () =>
    apiClient.get<HealthResponse>('/health', {
      auth: false,
      timeoutMs: 8_000,
    }),
};
