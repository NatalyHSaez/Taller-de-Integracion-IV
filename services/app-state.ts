import { authSession, type AuthSessionMode } from './auth-session';
import { demo, type Permissions } from './demo-store';

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
  permissions: Permissions;
  sessionMode: AuthSessionMode | null;
  isAuthenticated: boolean;
  hasSelectedPatient: boolean;
};

type DemoSnapshot = ReturnType<typeof demo.snapshot>;
type AuthSnapshot = ReturnType<typeof authSession.snapshot>;

let previousDemoSnapshot: DemoSnapshot | null = null;
let previousAuthSnapshot: AuthSnapshot | null = null;
let previousDerivedState: GlobalAppState | null = null;

function toPatient(patient: ReturnType<typeof demo.patient>): GlobalPatient | null {
  if (!patient) return null;

  return {
    id: patient.id,
    name: patient.name,
    email: patient.email,
  };
}

function deriveState(): GlobalAppState {
  const account = demo.user();
  const selectedPatient = toPatient(demo.patient());
  const sessionMode = account ? authSession.mode() ?? 'mock' : null;

  return {
    user: account
      ? {
          id: account.id,
          name: account.name,
          email: account.email,
          role: account.role,
          source: sessionMode === 'backend' ? 'backend' : 'mock',
        }
      : null,
    selectedPatient,
    patients: demo.patients().map((patient) => ({
      id: patient.id,
      name: patient.name,
      email: patient.email,
    })),
    permissions: demo.permissions(),
    sessionMode,
    isAuthenticated: Boolean(account),
    hasSelectedPatient: Boolean(selectedPatient),
  };
}

function snapshot(): GlobalAppState {
  const demoSnapshot = demo.snapshot();
  const authSnapshot = authSession.snapshot();

  if (
    previousDerivedState &&
    previousDemoSnapshot === demoSnapshot &&
    previousAuthSnapshot === authSnapshot
  ) {
    return previousDerivedState;
  }

  previousDemoSnapshot = demoSnapshot;
  previousAuthSnapshot = authSnapshot;
  previousDerivedState = deriveState();
  return previousDerivedState;
}

export const appState = {
  snapshot,

  subscribe(listener: () => void) {
    const unsubscribeDemo = demo.subscribe(listener);
    const unsubscribeAuth = authSession.subscribe(listener);

    return () => {
      unsubscribeDemo();
      unsubscribeAuth();
    };
  },

  selectPatient(patientId: string) {
    demo.select(patientId);
  },
};
