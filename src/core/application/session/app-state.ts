import type { AppStateDependencies, LinkedPatient } from './linked-patients-port';
import { authSession, type AuthSessionMode } from './auth-session';
import { ApiError } from '../../infrastructure/http/errors';


export type Permissions = { alerts: boolean; read: boolean; write: boolean };
export type GlobalUser = { id: string; name: string; email: string; role: 'patient' | 'caregiver'; source: 'backend' };
export type GlobalPatient = { id: string; name: string; email: string };
export type GlobalAppState = {
  user: GlobalUser | null;
  selectedPatient: GlobalPatient | null;
  patients: GlobalPatient[];
  permissions: Permissions & { profile: boolean };
  sessionMode: AuthSessionMode | null;
  isAuthenticated: boolean;
  hasSelectedPatient: boolean;
};

let dependencies: AppStateDependencies | null = null;

/** Se configura una sola vez en la raíz de composición, antes de restaurar sesión. */
export function configureAppState(next: AppStateDependencies): void {
  dependencies = next;
}

type AuthSnapshot = ReturnType<typeof authSession.snapshot>;
let previousAuthSnapshot: AuthSnapshot | null = null;
let previousDerivedState: GlobalAppState | null = null;
let realPatients: LinkedPatient[] = [];
let realSelectedPatientId: string | null = null;
let realPatientsUserId: string | null = null;
let realPatientsGeneration = -1;
const realPatientsListeners = new Set<() => void>();
function notifyRealPatientsChange() {
  previousDerivedState = null;
  realPatientsListeners.forEach(listener => listener());
}

/** Nunca aceptar vínculos duplicados, incompletos ni de un rol distinto al cuidador. */
export function checkLinkedPatients(raw: unknown): LinkedPatient[] {
  const invalid = () => new ApiError({
    code: 'INVALID_API_RESPONSE', message: 'El servidor devolvió vinculaciones inválidas.',
  });
  if (!Array.isArray(raw)) throw invalid();
  const ids = new Set<string>();
  const result: LinkedPatient[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid();
    const link = item as Record<string, unknown>;
    if (link.relationshipType === 'DOCTOR') continue;
    if (link.relationshipType !== 'CAREGIVER' ||
        typeof link.patientId !== 'string' || !link.patientId ||
        typeof link.fullName !== 'string' || !link.fullName.trim() ||
        typeof link.relationshipId !== 'string' || !link.relationshipId ||
        !Array.isArray(link.permissions) ||
        !link.permissions.every((code: unknown) => typeof code === 'string') ||
        ids.has(link.patientId)) throw invalid();
    ids.add(link.patientId);
    result.push(item as LinkedPatient);
  }
  return result;
}

async function loadRealPatients(): Promise<void> {
  if (authSession.mode() !== 'backend') return;
  const user = authSession.user();
  if (!user?.roles.includes('CAREGIVER')) return;
  const userId = user.id;
  const generation = authSession.generation();
  try {
    if (!dependencies) {
      throw new ApiError({ code: 'APP_STATE_NOT_CONFIGURED', message: 'No se configuró la consulta de pacientes.' });
    }
    const patients = checkLinkedPatients(await dependencies.listLinkedPatients());
    if (authSession.mode() !== 'backend' ||
        authSession.generation() !== generation || authSession.user()?.id !== userId) return;
    realPatients = patients;
    realPatientsUserId = userId;
    realPatientsGeneration = generation;
    if (!patients.some(p => p.patientId === realSelectedPatientId)) {
      realSelectedPatientId = patients.length === 1 ? patients[0].patientId : null;
    }
    notifyRealPatientsChange();
  } catch (error) {
    if (authSession.mode() === 'backend' && authSession.generation() === generation &&
        authSession.user()?.id === userId) {
      realPatients = [];
      realPatientsUserId = userId;
      realPatientsGeneration = generation;
      realSelectedPatientId = null;
      dependencies?.clearClinicalCache();
      notifyRealPatientsChange();
    }
    throw error;
  }
}

export function permissionsFromCodes(codes: readonly string[] | null | undefined): Permissions {
  const list = codes ?? [];
  return {
    alerts: list.includes('ALERT_VIEW'),
    read: list.includes('MEASUREMENT_VIEW'),
    write: list.includes('MEASUREMENT_CREATE'),
  };
}

function deriveState(): GlobalAppState {
  const user = authSession.mode() === 'backend' ? authSession.user() : null;
  const role = user?.roles.includes('PATIENT') ? 'patient'
    : user?.roles.includes('CAREGIVER') ? 'caregiver' : null;
  const belongsToCurrentUser = Boolean(user && role === 'caregiver' &&
    realPatientsUserId === user.id && realPatientsGeneration === authSession.generation());
  const patients: GlobalPatient[] = belongsToCurrentUser
    ? realPatients.map(patient => ({ id: patient.patientId, name: patient.fullName, email: '' }))
    : [];
  const selfPatient: GlobalPatient | null = user && role === 'patient'
    ? { id: user.id, name: user.fullName, email: user.email } : null;
  const selectedPatient = selfPatient ?? patients.find(p => p.id === realSelectedPatientId) ?? null;
  const linked = belongsToCurrentUser
    ? realPatients.find(p => p.patientId === selectedPatient?.id) : undefined;
  const permissions = role === 'patient'
    ? { alerts: true, read: true, write: true, profile: true }
    : {
        ...permissionsFromCodes(linked?.permissions),
        profile: Boolean(linked?.permissions.includes('PATIENT_PROFILE_VIEW')),
      };
  return {
    user: user && role ? { id: user.id, name: user.fullName, email: user.email, role, source: 'backend' } : null,
    selectedPatient,
    patients,
    permissions,
    sessionMode: user && role ? 'backend' : null,
    isAuthenticated: Boolean(user && role),
    hasSelectedPatient: Boolean(selectedPatient),
  };
}

function snapshot(): GlobalAppState {
  const authSnapshot = authSession.snapshot();
  if (previousDerivedState && previousAuthSnapshot === authSnapshot) return previousDerivedState;
  previousAuthSnapshot = authSnapshot;
  previousDerivedState = deriveState();
  return previousDerivedState;
}

export const appState = {
  snapshot,
  loadRealPatients,
  subscribe(listener: () => void) {
    const unsubscribe = authSession.subscribe(listener);
    realPatientsListeners.add(listener);
    return () => { unsubscribe(); realPatientsListeners.delete(listener); };
  },
  selectPatient(patientId: string) {
    if (authSession.mode() !== 'backend') return;
    const user = authSession.user();
    if (!user?.roles.includes('CAREGIVER') ||
        realPatientsUserId !== user.id || realPatientsGeneration !== authSession.generation()) return;
    if (!realPatients.some(p => p.patientId === patientId)) return;
    realSelectedPatientId = patientId;
    notifyRealPatientsChange();
  },
};
