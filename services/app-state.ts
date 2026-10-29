import { authSession, type AuthSessionMode } from './auth-session';
import { demo, type Permissions } from './demo-store';
import { patientAccess } from './patient-access';

export type GlobalUser = {
  id: string;
  name: string;
  email: string;
  role: 'patient' | 'caregiver';
  source: 'backend' | 'mock';
};

export type GlobalPatient = {
  id: string;
  name: string;
  email: string;
};

export type GlobalAppState = {
  user: GlobalUser | null;
  selectedPatient: GlobalPatient | null;
  patients: GlobalPatient[];
  permissions: Permissions & { profile: boolean };
  sessionMode: AuthSessionMode | null;
  isAuthenticated: boolean;
  hasSelectedPatient: boolean;
  patientsLoading: boolean;
  patientsLoaded: boolean;
  patientsError: string | null;
};

type DemoSnapshot = ReturnType<typeof demo.snapshot>;
type AuthSnapshot = ReturnType<typeof authSession.snapshot>;

let previousDemoSnapshot: DemoSnapshot | null = null;
let previousAuthSnapshot: AuthSnapshot | null = null;
let previousDerivedState: GlobalAppState | null = null;
let previousAccessSnapshot: ReturnType<typeof patientAccess.snapshot> | null = null;

function toPatient(patient: ReturnType<typeof demo.patient>): GlobalPatient | null {
  if (!patient) return null;

  return {
    id: patient.id,
    name: patient.name,
    email: patient.email,
  };
}

function deriveState(): GlobalAppState {
  const sessionMode = authSession.mode();
  const authenticatedUser = authSession.user();
  const access = patientAccess.snapshot();
  if (sessionMode === 'backend') {
    const role = authenticatedUser?.roles.includes('PATIENT') ? 'patient' :
      authenticatedUser?.roles.includes('CAREGIVER') ? 'caregiver' : null;
    const user: GlobalUser | null = role && authenticatedUser ? {
      id: authenticatedUser.id, name: authenticatedUser.fullName,
      email: authenticatedUser.email, role, source: 'backend',
    } : null;
    const relevant = role === 'caregiver' && access.generation === authSession.generation();
    const related = relevant && access.loaded ? access.patients : [];
    const patients: GlobalPatient[] = role === 'patient' && user ? [
      { id: user.id, name: user.name, email: user.email },
    ] : related.map((p) => ({ id: p.patientId, name: p.fullName, email: '' }));
    const selectedPatient = role === 'patient' ? patients[0] ?? null :
      patients.find((p) => p.id === access.selectedId) ?? null;
    const permissionCodes = related.find((p) => p.patientId === selectedPatient?.id)?.permissions ?? [];
    const permissions = role === 'patient' ? { alerts: true, read: true, write: true, profile: true } : {
      alerts: permissionCodes.includes('ALERT_VIEW'),
      read: permissionCodes.includes('MEASUREMENT_VIEW'),
      write: permissionCodes.includes('MEASUREMENT_CREATE'),
      profile: permissionCodes.includes('PATIENT_PROFILE_VIEW'),
    };
    return { user, selectedPatient, patients, permissions, sessionMode,
      isAuthenticated: Boolean(user), hasSelectedPatient: Boolean(selectedPatient),
      patientsLoading: relevant ? access.loading : Boolean(user?.role === 'caregiver'),
      patientsLoaded: role === 'patient' || (relevant && access.loaded),
      patientsError: relevant ? access.error : null };
  }
  const account = sessionMode === 'mock' ? demo.user() : undefined;
  const selectedPatient = account ? toPatient(demo.patient()) : null;
  return {
    user: account ? { id: account.id, name: account.name,
      email: account.email, role: account.role, source: 'mock' } : null,
    selectedPatient,
    patients: account ? demo.patients().map((p) => ({ id: p.id, name: p.name, email: p.email })) : [],
    permissions: account ? { ...demo.permissions(), profile: true } : { alerts: false, read: false, write: false, profile: false },
    sessionMode, isAuthenticated: Boolean(account), hasSelectedPatient: Boolean(selectedPatient),
    patientsLoading: false, patientsLoaded: true, patientsError: null,
  };
}

function snapshot(): GlobalAppState {
  const demoSnapshot = demo.snapshot();
  const authSnapshot = authSession.snapshot();
  const accessSnapshot = patientAccess.snapshot();

  if (
    previousDerivedState &&
    previousDemoSnapshot === demoSnapshot &&
    previousAuthSnapshot === authSnapshot &&
    previousAccessSnapshot === accessSnapshot
  ) {
    return previousDerivedState;
  }

  previousDemoSnapshot = demoSnapshot;
  previousAuthSnapshot = authSnapshot;
  previousAccessSnapshot = accessSnapshot;
  previousDerivedState = deriveState();
  return previousDerivedState;
}

export const appState = {
  snapshot,

  subscribe(listener: () => void) {
    const unsubscribeDemo = demo.subscribe(listener);
    const unsubscribeAuth = authSession.subscribe(listener);
    const unsubscribeAccess = patientAccess.subscribe(listener);

    return () => {
      unsubscribeDemo();
      unsubscribeAuth();
      unsubscribeAccess();
    };
  },

  async selectPatient(patientId: string): Promise<void> {
    if (authSession.mode() === 'backend') return patientAccess.select(patientId);
    if (authSession.mode() !== 'mock') throw new Error('Inicia sesión para seleccionar un paciente.');
    demo.select(patientId);
  },
  async refreshPatients(): Promise<void> {
    if (authSession.mode() === 'backend' && authSession.user()?.roles.includes('CAREGIVER')) {
      await patientAccess.refresh();
    }
  },
};
