/** Estado de un microservicio según GET /api/v1/health. */
export type HealthServiceStatus = 'ok' | `error ${number}` | 'sin respuesta' | string;

/** Respuesta real de GET /api/v1/health. */
export type HealthResponse = {
  status: 'ok' | 'degradado';
  servicios: Record<string, HealthServiceStatus>;
};
