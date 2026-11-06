import { getPatient, type PatientProfileResponse } from './api';
import { normalizeApiError } from './errors';

/**
 * Ficha del paciente: GET /api/v1/patients/{patientId}.
 *
 * - El backend permite el acceso al propio paciente, a su médico y a los
 *   cuidadores con el permiso PATIENT_PROFILE_VIEW (si no, responde 403).
 * - Los campos nulos se muestran como "Sin información": nunca se inventan.
 * - Cambiar de paciente descarta la ficha anterior y las respuestas tardías.
 * - No depende de React: la pantalla se suscribe con useSyncExternalStore.
 */

export type PatientProfileErrorKind = 'session' | 'forbidden' | 'not_found' | 'network';

export type PatientProfileError = {
  kind: PatientProfileErrorKind;
  title: string;
  message: string;
  /** Solo los fallos de red o del servidor tienen sentido reintentarlos. */
  retryable: boolean;
};

export type PatientProfileState = {
  patientId: string | null;
  profile: PatientProfileResponse | null;
  loading: boolean;
  error: PatientProfileError | null;
};

const NOT_FOUND: PatientProfileError = {
  kind: 'not_found',
  title: 'Paciente no encontrado',
  message: 'Este paciente no existe o su ficha ya no está disponible.',
  retryable: false,
};

export function classifyPatientProfileError(error: unknown): PatientProfileError {
  const apiError = normalizeApiError(error);
  if (apiError.status === 401) {
    return {
      kind: 'session',
      title: 'Sesión expirada',
      message: 'Tu sesión expiró. Vuelve a iniciar sesión para ver la ficha.',
      retryable: false,
    };
  }
  if (apiError.status === 403) {
    return {
      kind: 'forbidden',
      title: 'Sin permiso para ver la ficha',
      message:
        'No tienes una relación vigente con este paciente o no te ha dado el permiso para ver su perfil. ' +
        'Pídele que lo active en Vínculos.',
      retryable: false,
    };
  }
  if (apiError.status === 404 || apiError.code === 'PATIENT_NOT_FOUND') return NOT_FOUND;
  return {
    kind: 'network',
    title: 'No se pudo cargar el paciente',
    message: 'Verifica tu conexión e inténtalo nuevamente.',
    retryable: true,
  };
}

/** Paciente cuya ficha se muestra: el propio paciente o el seleccionado por el cuidador. */
export function resolveProfilePatientId(input: {
  isBackend: boolean;
  roles: readonly string[] | undefined;
  userId: string | undefined;
  selectedPatientId: string | null | undefined;
}): string | null {
  if (!input.isBackend) return null;
  if (input.roles?.includes('PATIENT')) return input.userId ?? null;
  if (input.roles?.includes('CAREGIVER')) return input.selectedPatientId ?? null;
  return null;
}

/** "1950-03-07" → "07/03/1950". Nulo o inválido → null (no se inventa). */
export function formatBirthDate(value: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

export function formatAge(age: number | null | undefined): string | null {
  if (typeof age !== 'number' || !Number.isFinite(age) || age < 0) return null;
  return age === 1 ? '1 año' : `${age} años`;
}

const SEX_LABELS: Record<string, string> = {
  female: 'Femenino',
  f: 'Femenino',
  femenino: 'Femenino',
  male: 'Masculino',
  m: 'Masculino',
  masculino: 'Masculino',
  other: 'Otro',
  otro: 'Otro',
  intersex: 'Intersexual',
};

export function formatBiologicalSex(value: string | null | undefined): string | null {
  const clean = value?.trim();
  if (!clean) return null;
  return SEX_LABELS[clean.toLowerCase()] ?? clean;
}

const MODE_LABELS: Record<string, string> = {
  autonomo: 'Autónomo: registra sus propias mediciones',
  autonomous: 'Autónomo: registra sus propias mediciones',
  asistido: 'Asistido: un cuidador lo apoya',
  assisted: 'Asistido: un cuidador lo apoya',
};

export function formatManagementMode(value: string | null | undefined): string | null {
  const clean = value?.trim();
  if (!clean) return null;
  return MODE_LABELS[clean.toLowerCase()] ?? clean;
}

type FetchPatient = (patientId: string) => Promise<PatientProfileResponse>;

const EMPTY: PatientProfileState = { patientId: null, profile: null, loading: false, error: null };

export function createPatientProfile(fetchPatient: FetchPatient = getPatient) {
  let state: PatientProfileState = EMPTY;
  let generation = 0;
  const listeners = new Set<() => void>();

  const set = (next: PatientProfileState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  async function load(patientId: string) {
    const current = ++generation;
    set({ patientId, profile: null, loading: true, error: null });
    try {
      const profile = await fetchPatient(patientId);
      if (current !== generation) return;
      // Defensa: solo se acepta la ficha del paciente pedido.
      if (profile?.id && profile.id !== patientId) {
        set({ patientId, profile: null, loading: false, error: NOT_FOUND });
        return;
      }
      set({ patientId, profile, loading: false, error: null });
    } catch (error) {
      if (current !== generation) return;
      set({ patientId, profile: null, loading: false, error: classifyPatientProfileError(error) });
    }
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Abre la ficha de un paciente; null limpia todo. Mismo paciente ya cargado: no consulta. */
    setPatient(patientId: string | null): Promise<void> {
      if (!patientId) {
        generation++;
        set(EMPTY);
        return Promise.resolve();
      }
      if (patientId === state.patientId && (state.profile || state.loading)) return Promise.resolve();
      return load(patientId);
    },
    retry(): Promise<void> {
      return state.patientId ? load(state.patientId) : Promise.resolve();
    },
  };
}
