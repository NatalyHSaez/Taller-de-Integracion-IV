/**
 * Adaptador HTTP del microservicio de evaluación (alertas), vía API Gateway:
 *   GET  /patients/{patientId}/alerts[?status=OPEN|READ]
 *   POST /patients/{patientId}/alerts/{alertId}/read  → 204
 */
import { apiClient } from '../../../../core/infrastructure/http/api-client';
import { ApiError } from '../../../../core/infrastructure/http/errors';
import type { AlertsService, PatientAlert } from '../../domain/alert';

const alertsPath = (patientId: string) => `/patients/${encodeURIComponent(patientId)}/alerts`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Valida los campos del contrato AlertOut vigente, sin alias históricos. */
export function toPatientAlert(raw: unknown): PatientAlert | null {
  if (!isRecord(raw)) return null;
  const { id, readingId, ruleCode, severity, explanation, status, createdAt, readAt } = raw;
  if (typeof id !== 'string' || !id.trim() ||
      typeof readingId !== 'string' || !readingId.trim() ||
      typeof ruleCode !== 'string' || !ruleCode.trim() ||
      typeof severity !== 'string' || !severity.trim() ||
      typeof explanation !== 'string' ||
      (status !== 'OPEN' && status !== 'READ') ||
      typeof createdAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(createdAt) || !Number.isFinite(Date.parse(createdAt)) ||
      (readAt !== null && (typeof readAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T/.test(readAt) || !Number.isFinite(Date.parse(readAt))))) {
    return null;
  }
  return { id, readingId, ruleCode, severity, explanation, status, createdAt, readAt };
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
    if (!item || (status !== undefined && item.status !== status) || seen.has(item.id)) {
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
