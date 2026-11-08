import { getMePatients, type MyPatientResponse } from '../../../modules/relationships/infrastructure/relationships-api';
import { authSession, type AuthSessionMode } from './auth-session';
import { demo, type Permissions } from '../../../modules/demo/infrastructure/demo-store';
import { ApiError } from '../../infrastructure/http/errors';

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

// Pacientes obtenidos desde el backend real.
let realPatients: MyPatientResponse[] = [];

// Identificador del paciente real seleccionado.
let realSelectedPatientId: string | null = null;

// Identifica a qué usuario pertenecen los datos cargados.
let realPatientsUserId: string | null = null;

// Notifica a los componentes cuando cambia el estado real.
const realPatientsListeners = new Set<() => void>();

function notifyRealPatientsChange() {
  previousDerivedState = null;

  realPatientsListeners.forEach((listener) => listener());
}

async function loadRealPatients(): Promise<void> {
  if (authSession.mode() !== 'backend') {
    return;
  }

  const user = authSession.user();

  if (!user || !user.roles.includes('CAREGIVER')) {
    return;
  }

  const userId = user.id;

  try {
    const patients = await getMePatients();
    if (!Array.isArray(patients)) {
      throw new ApiError({
        code: 'INVALID_API_RESPONSE',
        message: 'La lista de pacientes vinculados tiene un formato inesperado.',
      });
    }

    // Evita guardar resultados de una sesión que ya terminó.
    if (
      authSession.mode() !== 'backend' ||
      authSession.user()?.id !== userId
    ) {
      return;
    }

    realPatients = patients;
    realPatientsUserId = userId;

    // Conserva la selección si el vínculo sigue existiendo.
    const selectedStillExists = patients.some(
      (patient) => patient.patientId === realSelectedPatientId
    );

    if (!selectedStillExists) {
      realSelectedPatientId =
        patients.length === 1 ? patients[0].patientId : null;
    }

    notifyRealPatientsChange();
  } catch (error) {
    console.error('Error cargando pacientes reales:', error);
    throw error;
  }
}

/**
 * Permisos reales con sesión backend: el paciente tiene todos; el cuidador,
 * los de su vínculo con el paciente seleccionado (GET /me/patients):
 * MEASUREMENT_VIEW → read, MEASUREMENT_CREATE → write, ALERT_VIEW → alerts.
 */
export function permissionsFromCodes(codes: readonly string[] | null | undefined): Permissions {
  const list = codes ?? [];
  return {
    alerts: list.includes('ALERT_VIEW'),
    read: list.includes('MEASUREMENT_VIEW'),
    write: list.includes('MEASUREMENT_CREATE'),
  };
}

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
  const sessionMode = account ? authSession.mode() ?? 'mock' : null;

  const isBackendSession = sessionMode === 'backend';

  // Solo utilizar pacientes reales cuando pertenecen
  // al cuidador que tiene la sesión abierta.
  const belongsToCurrentUser =
    isBackendSession &&
    account?.role === 'caregiver' &&
    realPatientsUserId === account.id;

  const patients: GlobalPatient[] = isBackendSession
    ? (belongsToCurrentUser ? realPatients : []).map((patient) => ({
        id: patient.patientId,
        name: patient.fullName,
        email: '',
      }))
    : demo.patients().map((patient) => ({
        id: patient.id,
        name: patient.name,
        email: patient.email,
      }));

  // En sesión real, un paciente se acompaña a sí mismo: su patientId es su
  // propio id de usuario (así lo valida el gateway).
  const backendUser = isBackendSession ? authSession.user() : null;
  const selfPatient: GlobalPatient | null =
    backendUser && account?.role === 'patient'
      ? { id: backendUser.id, name: backendUser.fullName, email: backendUser.email }
      : null;

  const selectedPatient = isBackendSession
    ? selfPatient ??
      patients.find((patient) => patient.id === realSelectedPatientId) ??
      null
    : toPatient(demo.patient());

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
    patients,
    permissions: !isBackendSession
      ? demo.permissions()
      : account?.role === 'patient'
        ? { alerts: true, read: true, write: true }
        : permissionsFromCodes(
            belongsToCurrentUser
              ? realPatients.find((patient) => patient.patientId === selectedPatient?.id)?.permissions
              : [],
          ),
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
  loadRealPatients,

  subscribe(listener: () => void) {
    const unsubscribeDemo = demo.subscribe(listener);
    const unsubscribeAuth = authSession.subscribe(listener);

    // Escucha también los cambios de pacientes reales.
    realPatientsListeners.add(listener);

    return () => {
      unsubscribeDemo();
      unsubscribeAuth();

      // Elimina el listener al desmontar el componente.
      realPatientsListeners.delete(listener);
    };
  },

  selectPatient(patientId: string) {
  if (authSession.mode() === 'backend') {
    const userId = authSession.user()?.id;

    // Solo permite seleccionar pacientes vinculados
    // al usuario autenticado.
    if (!userId || realPatientsUserId !== userId) {
      return;
    }

    const patientExists = realPatients.some(
      (patient) => patient.patientId === patientId
    );

    if (!patientExists) {
      console.warn('El paciente no está vinculado al cuidador.');
      return;
    }

    realSelectedPatientId = patientId;
    notifyRealPatientsChange();
    return;
  }

  // Conserva el funcionamiento del modo demostración.
  demo.select(patientId);
},
};
