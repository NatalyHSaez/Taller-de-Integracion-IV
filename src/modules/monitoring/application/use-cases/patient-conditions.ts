import { authSession } from '../../../../core/application/session/auth-session';
import { appState } from '../../../../core/application/session/app-state';
import { ApiError } from '../../../../core/domain/errors';
import type { PatientCondition } from '../../domain/patient-condition';
import { monitoringRepository } from '../ports/monitoring-port';

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
function validDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const date = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
}
export function parsePatientConditions(raw: unknown): PatientCondition[] {
  const invalid = () => new ApiError({ code: 'INVALID_API_RESPONSE', message: 'El servidor devolvió condiciones clínicas inválidas.' });
  if (!Array.isArray(raw)) throw invalid();
  const seen = new Set<string>();
  return raw.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        !nonEmpty(item.conditionCode) || !nonEmpty(item.name) || !nonEmpty(item.status) ||
        (item.startedAt !== null && !validDate(item.startedAt)) || seen.has(item.conditionCode)) throw invalid();
    seen.add(item.conditionCode);
    return { conditionCode: item.conditionCode, name: item.name, startedAt: item.startedAt, status: item.status };
  });
}

/** El paciente activo y sus permisos se verifican antes y después de consultar. */
export async function listPatientConditions(patientId: string): Promise<PatientCondition[]> {
  const generation = authSession.generation();
  const userId = authSession.user()?.id;
  const authorized = () => {
    const state = appState.snapshot();
    return state.sessionMode === 'backend' && state.user?.id === userId &&
      state.selectedPatient?.id === patientId && state.permissions.read;
  };
  if (!userId || authSession.mode() !== 'backend') throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401, message: 'Inicia sesión para consultar las condiciones.' });
  if (!patientId || !authorized()) throw new ApiError({ code: 'FORBIDDEN', status: 403, message: 'No tienes permiso para consultar las condiciones de este paciente.' });
  const raw = await monitoringRepository().listPatientConditions(patientId);
  if (authSession.generation() !== generation || !authorized()) throw new ApiError({ code: 'SESSION_CHANGED', message: 'Cambió la sesión, el paciente o sus permisos.' });
  return parsePatientConditions(raw);
}
