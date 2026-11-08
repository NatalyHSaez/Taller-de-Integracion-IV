/**
 * Adaptador HTTP del microservicio de evaluación (alertas), vía API Gateway:
 *   GET  /patients/{patientId}/alerts[?status=OPEN|READ]
 *   POST /patients/{patientId}/alerts/{alertId}/read  → 204
 */
import { apiClient } from '../../../core/infrastructure/http/api-client';
import { normalizeApiError } from '../../../core/infrastructure/http/errors';
import type { AlertsService, PatientAlert } from '../domain/alert';

const alertsPath = (patientId: string) => `/patients/${encodeURIComponent(patientId)}/alerts`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

/** Normaliza un elemento de la respuesta (acepta `id` del backend o `alertId` del mock). */
export function toPatientAlert(raw: unknown): PatientAlert | null {
  if (!isRecord(raw)) return null;
  const id = raw.id ?? raw.alertId;
  const status = typeof raw.status === 'string' ? raw.status.toUpperCase() : '';
  if (typeof id !== 'string' || (status !== 'OPEN' && status !== 'READ') || typeof raw.createdAt !== 'string') {
    return null;
  }
  return {
    id,
    readingId: typeof raw.readingId === 'string' ? raw.readingId : null,
    ruleCode: typeof raw.ruleCode === 'string' ? raw.ruleCode : '',
    severity: typeof raw.severity === 'string' ? raw.severity : '',
    explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
    status,
    createdAt: raw.createdAt,
    readAt: typeof raw.readAt === 'string' ? raw.readAt : null,
  };
}

export const backendAlertsService: AlertsService = {
  async list(patientId, status) {
    const raw = await apiClient.get<unknown>(alertsPath(patientId), { query: { status } });
    if (!Array.isArray(raw)) {
      throw normalizeApiError(new Error('Las alertas tienen un formato inesperado.'));
    }
    return raw.map(toPatientAlert).filter((alert): alert is PatientAlert => alert !== null);
  },
  async markRead(patientId, alertId) {
    // Responde 204 sin cuerpo; también si la alerta ya estaba leída.
    await apiClient.post<void>(`${alertsPath(patientId)}/${encodeURIComponent(alertId)}/read`);
  },
};
