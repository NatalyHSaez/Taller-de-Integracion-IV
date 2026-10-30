import type { AlertaItem } from '@/constants/alerts-mock';
import type { AlertResponse } from '@/types/api';
import { authSession } from './auth-session';
import { apiClient } from './api';
import { appState } from './app-state';
import { dataClient } from './data';
import { ApiError, normalizeApiError } from './errors';
import { MOCK_ALERTS } from './mocks/api-data';

export type AlertStatus = 'OPEN' | 'READ';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isDate = (value: unknown): value is string =>
  typeof value === 'string' && ISO.test(value) && /(Z|[+-]\d{2}:\d{2})$/i.test(value) &&
  Number.isFinite(Date.parse(value));
const invalidResponse = () => new ApiError({
  code: 'INVALID_API_RESPONSE', message: 'El servidor devolvió una lista de alertas inválida.',
});

/** No se generan alertas a partir de evaluaciones: solo se aceptan alertas persistidas. */
export function checkAlertList(value: unknown, status: AlertStatus): AlertResponse[] {
  if (!Array.isArray(value)) throw invalidResponse();
  const ids = new Set<string>();
  for (const row of value) {
    if (!isObject(row) || typeof row.id !== 'string' || !UUID.test(row.id) ||
        typeof row.readingId !== 'string' || !UUID.test(row.readingId) ||
        typeof row.ruleCode !== 'string' || !row.ruleCode.trim() ||
        typeof row.severity !== 'string' || !row.severity.trim() ||
        typeof row.explanation !== 'string' || !row.explanation.trim() ||
        row.status !== status || !isDate(row.createdAt) ||
        (row.readAt !== null && !isDate(row.readAt)) ||
        (row.status === 'READ' && row.readAt === null) || ids.has(row.id)) {
      throw invalidResponse();
    }
    ids.add(row.id);
  }
  return [...value].sort((a: AlertResponse, b: AlertResponse) =>
    Date.parse(b.createdAt) - Date.parse(a.createdAt)) as AlertResponse[];
}

/** La marca de leído de demostración jamás se envía al backend. */
let mockGeneration = -1;
const readDemo = new Map<string, string>();
function ensureMockGeneration() {
  const generation = authSession.generation();
  if (generation !== mockGeneration) {
    mockGeneration = generation;
    readDemo.clear();
  }
}
function demoList(patientId: string, status: AlertStatus): AlertResponse[] {
  ensureMockGeneration();
  // Los ejemplos de alertas del DTO pertenecen únicamente a este paciente de prueba.
  if (patientId !== '22222222-2222-4222-8222-222222222222') return [];
  return MOCK_ALERTS.map((alert) => ({
    ...alert,
    status: readDemo.has(alert.id) ? 'READ' as const : 'OPEN' as const,
    readAt: readDemo.get(alert.id) ?? null,
  })).filter((alert) => alert.status === status);
}

function requireAccess(patientId: string): { mode: 'mock' | 'backend'; generation: number } {
  const mode = authSession.mode();
  if (!mode || !authSession.user()) {
    throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401,
      message: 'Inicia sesión para consultar alertas.' });
  }
  const state = appState.snapshot();
  if (!patientId || state.selectedPatient?.id !== patientId || !state.permissions.alerts ||
      state.user?.source !== mode) {
    throw new ApiError({ code: 'FORBIDDEN', status: 403,
      message: 'No tienes permiso para consultar las alertas de este paciente.' });
  }
  if (mode === 'backend' && !UUID.test(patientId)) {
    throw new ApiError({ code: 'INVALID_PATIENT_ID', status: 422,
      message: 'El identificador del paciente no es válido.' });
  }
  return { mode, generation: authSession.generation() };
}
function stillAllowed(patientId: string, mode: 'mock' | 'backend', generation: number): boolean {
  const state = appState.snapshot();
  return authSession.generation() === generation && authSession.mode() === mode &&
    state.selectedPatient?.id === patientId && state.permissions.alerts && state.user?.source === mode;
}
function changed(): ApiError {
  return new ApiError({ code: 'SESSION_CHANGED',
    message: 'Cambió la sesión o el paciente. Vuelve a consultar las alertas.' });
}

export const alertsService = {
  /** GET filtrado por estado; el backend devuelve un array sin paginación. */
  async list(patientId: string, status: AlertStatus = 'OPEN', forceRefresh = false): Promise<AlertResponse[]> {
    const { mode, generation } = requireAccess(patientId);
    if (status !== 'OPEN' && status !== 'READ') {
      throw new ApiError({ code: 'INVALID_ALERT_STATUS', status: 422,
        message: 'El filtro de alertas no es válido.' });
    }
    if (mode === 'mock') return demoList(patientId, status);
    const path = `/patients/${encodeURIComponent(patientId)}/alerts`;
    const query = { status };
    try {
      const data = await dataClient.get<unknown>(path, {
        query, retry: false, cache: { ttlMs: 10_000, staleIfErrorMs: 0, forceRefresh },
      });
      if (!stillAllowed(patientId, mode, generation)) throw changed();
      try { return checkAlertList(data, status); }
      catch (cause) { dataClient.invalidate(path, query); throw cause; }
    } catch (cause) { throw normalizeApiError(cause); }
  },

  /** POST 204 sin body. Nunca se considera leída antes de obtener éxito remoto. */
  async markRead(patientId: string, alertId: string): Promise<void> {
    const { mode, generation } = requireAccess(patientId);
    if (typeof alertId !== 'string' || !UUID.test(alertId)) {
      throw new ApiError({ code: 'INVALID_ALERT_ID', status: 422,
        message: 'El identificador de alerta no es válido.' });
    }
    if (mode === 'mock') {
      ensureMockGeneration();
      const own = demoList(patientId, 'OPEN').find((row) => row.id === alertId);
      if (!own && !demoList(patientId, 'READ').some((row) => row.id === alertId)) {
        throw new ApiError({ code: 'ALERT_NOT_FOUND', status: 404,
          message: 'No existe esa alerta de demostración para este paciente.' });
      }
      if (own) readDemo.set(alertId, new Date().toISOString());
      return;
    }
    try {
      const result = await apiClient.post<void>(
        `/patients/${encodeURIComponent(patientId)}/alerts/${encodeURIComponent(alertId)}/read`,
      );
      if (!stillAllowed(patientId, mode, generation)) throw changed();
      // HTTP 204 se traduce a undefined; no parsear JSON ni aceptar cuerpos inesperados.
      if (result !== undefined) throw invalidResponse();
      dataClient.invalidatePatient(patientId);
    } catch (cause) { throw normalizeApiError(cause); }
  },
};

function toAlertItem(alert: AlertResponse): AlertaItem {
  const date = new Date(alert.createdAt);
  const clinicalSeverity = alert.severity.toUpperCase();
  return {
    id: alert.id,
    severidad: clinicalSeverity === 'BAJA' ? 'INFORMATIVA' :
      clinicalSeverity === 'MEDIA' ? 'ADVERTENCIA' : 'ALERTA',
    parametro: alert.ruleCode.startsWith('HTA') ? 'Presión arterial' :
      alert.ruleCode.startsWith('DM2') ? 'Glucosa' : 'Lectura clínica',
    mensaje: alert.explanation, comparacion: null,
    fecha: new Intl.DateTimeFormat('es-CL').format(date),
    hora: new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date),
    regla: alert.ruleCode,
  };
}

/** Compatibilidad del resumen; solo muestra alertas OPEN del paciente demo. */
export function getDemoAlerts(): AlertaItem[] {
  if (authSession.mode() !== 'mock') return [];
  const patient = appState.snapshot().selectedPatient;
  if (!patient || !appState.snapshot().permissions.alerts) return [];
  return demoList(patient.id, 'OPEN').map(toAlertItem);
}

/** Compatibilidad de consumidores previos; para S4 preferir alertsService.list. */
export async function getAlerts(): Promise<AlertaItem[]> {
  const patientId = appState.snapshot().selectedPatient?.id ?? '';
  return (await alertsService.list(patientId, 'OPEN')).map(toAlertItem);
}
