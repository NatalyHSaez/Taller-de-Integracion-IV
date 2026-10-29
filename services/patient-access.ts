import type { PatientProfileResponse, PatientSummaryResponse } from '@/types/api';
import { apiClient } from './api';
import { authSession } from './auth-session';
import { dataClient } from './data';
import { ApiError, normalizeApiError } from './errors';

/** Estado de relaciones provenientes del Gateway; nunca contiene pacientes mock. */
export type PatientAccessState = {
  generation: number | null;
  loading: boolean;
  loaded: boolean;
  patients: PatientSummaryResponse[];
  selectedId: string | null;
  error: string | null;
};

const empty = (): PatientAccessState => ({
  generation: null, loading: false, loaded: false, patients: [], selectedId: null, error: null,
});
let state = empty();
let pending: Promise<PatientSummaryResponse[]> | null = null;
const listeners = new Set<() => void>();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function emit(next: PatientAccessState) {
  state = next;
  listeners.forEach((listener) => listener());
}
function currentCaregiver(generation: number) {
  return authSession.mode() === 'backend' &&
    authSession.generation() === generation &&
    Boolean(authSession.user()?.roles.includes('CAREGIVER'));
}
function requireCaregiver() {
  if (authSession.mode() !== 'backend' || !authSession.user()?.roles.includes('CAREGIVER')) {
    throw new ApiError({ code: 'ROLE_NOT_ALLOWED', status: 403,
      message: 'Debes iniciar sesión como cuidador para seleccionar pacientes vinculados.' });
  }
  return authSession.generation();
}
function validatePatients(value: unknown): PatientSummaryResponse[] {
  if (!Array.isArray(value)) throw new ApiError({ code: 'INVALID_API_RESPONSE', message: 'El servidor devolvió una lista de pacientes inválida.' });
  const found = new Set<string>();
  return value.map((item): PatientSummaryResponse | null => {
    if (!item || typeof item !== 'object') throw new ApiError({ code: 'INVALID_API_RESPONSE', message: 'El servidor devolvió una relación inválida.' });
    const row = item as PatientSummaryResponse;
    if (row.relationshipType === 'DOCTOR') return null;
    if (!UUID_PATTERN.test(row.patientId) || !UUID_PATTERN.test(row.relationshipId) ||
        typeof row.fullName !== 'string' || row.relationshipType !== 'CAREGIVER' ||
        !Array.isArray(row.permissions) || !row.permissions.every((p) => typeof p === 'string') ||
        found.has(row.patientId)) {
      throw new ApiError({ code: 'INVALID_API_RESPONSE', message: 'El servidor devolvió identificadores o permisos inválidos.' });
    }
    found.add(row.patientId);
    return row;
  }).filter((item): item is PatientSummaryResponse => item !== null);
}

/** Fallar cerrado: al perder la relación o el servicio no se conservan permisos antiguos. */
async function refresh(): Promise<PatientSummaryResponse[]> {
  const generation = requireCaregiver();
  if (pending && state.generation === generation) return pending;
  if (state.generation !== generation) emit({ ...empty(), generation });
  emit({ ...state, generation, loading: true, error: null });
  const action = (async () => {
    try {
      // Sin caché expirada: los permisos pueden haberse revocado en el servidor.
      const list = validatePatients(await dataClient.get<PatientSummaryResponse[]>('/me/patients', {
        cache: false, retry: false,
      }));
      if (!currentCaregiver(generation)) throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesión cambió durante la consulta.' });
      const selectedId = list.some((p) => p.patientId === state.selectedId) ? state.selectedId : null;
      if (selectedId !== state.selectedId) dataClient.clearCache();
      emit({ generation, loading: false, loaded: true, patients: list, selectedId, error: null });
      return list;
    } catch (cause) {
      if (currentCaregiver(generation)) {
        dataClient.clearCache();
        emit({ generation, loading: false, loaded: false, patients: [], selectedId: null,
          error: normalizeApiError(cause).message });
      }
      throw cause;
    }
  })();
  pending = action;
  try { return await action; }
  finally { if (pending === action) pending = null; }
}

export const patientAccess = {
  snapshot: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  clear() {
    pending = null;
    emit(empty());
  },
  /** La pantalla de selección solicita el primer listado; evita fetch en cada render. */
  async ensureLoaded(): Promise<PatientSummaryResponse[]> {
    const generation = requireCaregiver();
    if (state.generation === generation && state.loaded && !state.loading) return state.patients;
    return refresh();
  },
  refresh,
  /** Verifica otra vez la relación antes de aceptar una selección. */
  async select(patientId: string): Promise<void> {
    const generation = requireCaregiver();
    if (!UUID_PATTERN.test(patientId)) throw new ApiError({ code: 'INVALID_PATIENT_ID', status: 422, message: 'El identificador del paciente no es válido.' });
    const list = await refresh();
    if (!currentCaregiver(generation)) throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesión cambió durante la selección.' });
    if (!list.some((item) => item.patientId === patientId)) {
      throw new ApiError({ code: 'FORBIDDEN', status: 403, message: 'Este paciente ya no está vinculado a tu cuenta.' });
    }
    if (state.selectedId !== patientId) dataClient.clearCache();
    emit({ ...state, selectedId: patientId });
  },
  /** No crea/actualiza un perfil: GET es el único endpoint disponible. */
  async getProfile(patientId: string): Promise<PatientProfileResponse> {
    const generation = authSession.generation();
    const user = authSession.user();
    if (authSession.mode() !== 'backend' || !user || !UUID_PATTERN.test(patientId)) {
      throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401, message: 'Inicia sesión con una cuenta válida.' });
    }
    if (user.roles.includes('PATIENT') ? user.id !== patientId :
      !currentCaregiver(generation) || state.generation !== generation || !state.loaded ||
      state.selectedId !== patientId ||
      !state.patients.find((p) => p.patientId === patientId)?.permissions.includes('PATIENT_PROFILE_VIEW')) {
      throw new ApiError({ code: 'FORBIDDEN', status: 403, message: 'No tienes permiso para consultar esta ficha.' });
    }
    const profile = await apiClient.get<PatientProfileResponse>(`/patients/${patientId}`);
    if (authSession.generation() !== generation || authSession.mode() !== 'backend') {
      throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesión cambió durante la consulta.' });
    }
    if (profile.id !== patientId) throw new ApiError({ code: 'INVALID_API_RESPONSE', message: 'El servidor devolvió otro paciente.' });
    return profile;
  },
};
