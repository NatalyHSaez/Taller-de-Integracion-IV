/**
 * Adaptador HTTP del microservicio de evaluación (alertas), vía API Gateway:
 *   GET  /patients/{patientId}/alerts[?status=OPEN|READ]
 *   POST /patients/{patientId}/alerts/{alertId}/read  → 204
 */
import { apiClient } from '../../../core/infrastructure/http/api-client';
import { ApiError } from '../../../core/infrastructure/http/errors';
import type { AlertsService, PatientAlert } from '../domain/alert';

const alertsPath = (patientId: string) => `/patients/${encodeURIComponent(patientId)}/alerts`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
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

/**
 * Las alertas son registros persistidos del backend. No descartar filas inválidas
 * silenciosamente: eso ocultaría alertas clínicas al paciente.
 */
export function checkAlertList(raw: unknown, status?: 'OPEN' | 'READ'): PatientAlert[] {
  const invalid = () => new ApiError({
    code: 'INVALID_API_RESPONSE',
    status: 502,
    message: 'El servidor devolvió una lista de alertas inválida.',
  });
  if (!Array.isArray(raw)) throw invalid();
  const seen = new Set<string>();
  const result: PatientAlert[] = [];
  for (const row of raw) {
    const item = toPatientAlert(row);
    if (!item || !item.id.trim() || !item.ruleCode.trim() || !item.severity.trim() ||
        typeof row.explanation !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T/.test(item.createdAt) ||
        !Number.isFinite(Date.parse(item.createdAt)) ||
        (item.readAt !== null && !Number.isFinite(Date.parse(item.readAt))) ||
        (status !== undefined && item.status !== status) || seen.has(item.id)) {
      throw invalid();
    }
    seen.add(item.id);
    result.push(item);
  }
  return result.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export const backendAlertsService: AlertsService = {
  async list(patientId, status) {
    const raw = await apiClient.get<unknown>(alertsPath(patientId), { query: { status } });
    return checkAlertList(raw, status);
  },
  async markRead(patientId, alertId) {
    // Responde 204 sin cuerpo; una operación real nunca es reemplazada por mocks.
    const result = await apiClient.post<unknown>(`${alertsPath(patientId)}/${encodeURIComponent(alertId)}/read`);
    if (result !== undefined) {
      throw new ApiError({ code: 'INVALID_API_RESPONSE', status: 502,
        message: 'El servidor devolvió una respuesta inesperada al marcar la alerta.' });
    }
  },
};
