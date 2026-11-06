import { getMePatients } from './api';
import { normalizeApiError } from './errors';
import { loadChartMeasurements } from './measurement-series';
import { backendAlertsService, type PatientAlert } from './patient-alerts';
import type { Measurement } from '@/types/measurement';

/**
 * Datos reales de la pantalla de Inicio (sesión backend):
 * - Últimas mediciones: GET /patients/{id}/measurements (presión, pulso, glucosa, peso).
 * - Alerta prioritaria: la alerta abierta más reciente de GET /patients/{id}/alerts?status=OPEN.
 * - Si se puede registrar: el paciente siempre; el cuidador solo con MEASUREMENT_CREATE
 *   (permisos de su vínculo en GET /me/patients).
 *
 * Las alertas son un extra: si fallan (por ejemplo, el cuidador no tiene ALERT_VIEW),
 * Inicio igual muestra las mediciones. Cambiar de paciente descarta lo anterior.
 */

export type HomeRole = 'patient' | 'caregiver';

export type HomeErrorKind = 'forbidden' | 'session' | 'network';

export type HomeSummaryState = {
  patientId: string | null;
  measurements: Measurement[];
  alert: PatientAlert | null;
  canRegister: boolean;
  loaded: boolean;
  loading: boolean;
  error: { kind: HomeErrorKind; message: string } | null;
};

export type HomeSummaryDeps = {
  measurements: (patientId: string) => Promise<Measurement[]>;
  openAlerts: (patientId: string) => Promise<PatientAlert[]>;
  caregiverPermissions: (patientId: string) => Promise<string[]>;
};

export const backendHomeDeps: HomeSummaryDeps = {
  measurements: (patientId) => loadChartMeasurements(patientId),
  openAlerts: (patientId) => backendAlertsService.list(patientId, 'OPEN'),
  async caregiverPermissions(patientId) {
    const mine = await getMePatients();
    return mine.find((item) => item.patientId === patientId && item.relationshipType === 'CAREGIVER')?.permissions ?? [];
  },
};

export function classifyHomeError(error: unknown): { kind: HomeErrorKind; message: string } {
  const apiError = normalizeApiError(error);
  if (apiError.status === 403) {
    return { kind: 'forbidden', message: 'El paciente aún no te ha dado acceso a sus mediciones.' };
  }
  if (apiError.status === 401) {
    return { kind: 'session', message: 'Tu sesión expiró. Vuelve a iniciar sesión.' };
  }
  return { kind: 'network', message: 'No se pudieron cargar las mediciones. Toca para reintentar.' };
}

/** La alerta abierta más reciente (las ALTA primero). */
export function pickPriorityAlert(alerts: readonly PatientAlert[]): PatientAlert | null {
  const open = alerts.filter((alert) => alert.status === 'OPEN');
  const rank = (severity: string) => (/alta|high|critica|critical/i.test(severity) ? 0 : 1);
  return (
    [...open].sort((a, b) => rank(a.severity) - rank(b.severity) || (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null
  );
}

const EMPTY: HomeSummaryState = {
  patientId: null,
  measurements: [],
  alert: null,
  canRegister: false,
  loaded: false,
  loading: false,
  error: null,
};

export function createHomeSummary(deps: HomeSummaryDeps = backendHomeDeps) {
  let state: HomeSummaryState = EMPTY;
  let role: HomeRole = 'patient';
  let generation = 0;
  const listeners = new Set<() => void>();

  const set = (next: HomeSummaryState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  async function load(patientId: string, keepData: boolean) {
    const current = ++generation;
    set(keepData ? { ...state, loading: true, error: null } : { ...EMPTY, patientId, loading: true });

    const permissionsPromise = role === 'patient'
      ? Promise.resolve(true)
      : deps.caregiverPermissions(patientId).then((codes) => codes.includes('MEASUREMENT_CREATE')).catch(() => false);
    const alertsPromise = deps.openAlerts(patientId).then(pickPriorityAlert).catch(() => null);

    try {
      const measurements = await deps.measurements(patientId);
      const [canRegister, alert] = await Promise.all([permissionsPromise, alertsPromise]);
      if (current !== generation) return;
      set({ patientId, measurements, alert, canRegister, loaded: true, loading: false, error: null });
    } catch (error) {
      const canRegister = await permissionsPromise;
      if (current !== generation) return;
      set({
        ...(keepData ? state : { ...EMPTY, patientId }),
        canRegister,
        loading: false,
        error: classifyHomeError(error),
      });
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
    /** Paciente activo (null limpia). Mismo paciente ya cargado: no vuelve a consultar. */
    setPatient(patientId: string | null, nextRole: HomeRole = 'patient'): Promise<void> {
      if (!patientId) {
        generation++;
        set(EMPTY);
        return Promise.resolve();
      }
      const changed = patientId !== state.patientId || nextRole !== role;
      role = nextRole;
      if (!changed) return Promise.resolve();
      return load(patientId, false);
    },
    /** Al volver a Inicio (p. ej. después de registrar) o al reintentar. */
    refresh(): Promise<void> {
      return state.patientId ? load(state.patientId, state.loaded) : Promise.resolve();
    },
  };
}
