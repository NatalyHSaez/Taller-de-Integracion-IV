import { normalizeApiError } from '../../../core/infrastructure/http/errors';
import type { AlertFilter, AlertsService, PatientAlert } from '../domain/alert';
import { backendAlertsService } from '../infrastructure/alerts-api';

/**
 * Alertas del paciente.
 * - GET  /api/v1/patients/{patientId}/alerts[?status=OPEN|READ]
 * - POST /api/v1/patients/{patientId}/alerts/{alertId}/read  → 204
 *
 * El backend no tiene GET de una alerta individual: el detalle se arma con los
 * datos de la lista. Los contadores salen de la lista completa del backend.
 * No depende de React: la pantalla se suscribe con useSyncExternalStore.
 */

export type AlertErrorKind = 'session' | 'forbidden' | 'not_found' | 'network';

export function classifyAlertError(cause: unknown): { kind: AlertErrorKind; message: string } {
  const error = normalizeApiError(cause, 'No se pudieron cargar las alertas.');
  if (error.status === 401) {
    return { kind: 'session', message: 'Tu sesión expiró. Inicia sesión nuevamente para ver las alertas.' };
  }
  if (error.status === 403 || error.code === 'FORBIDDEN') {
    return {
      kind: 'forbidden',
      message: 'No tienes permiso para ver las alertas de este paciente. Pídele que revise tus permisos.',
    };
  }
  if (error.status === 404 || error.code === 'ALERT_NOT_FOUND') {
    return { kind: 'not_found', message: 'Esta alerta ya no existe o no pertenece al paciente seleccionado.' };
  }
  return {
    kind: 'network',
    message: 'No se pudo conectar con el servicio. Revisa tu conexión e inténtalo nuevamente.',
  };
}

export type AlertCounts = { all: number; open: number; read: number };

export type AlertsState = {
  patientId: string | null;
  filter: AlertFilter;
  items: PatientAlert[];
  /** Contadores de la lista completa del backend (null si aún no se cargó). */
  counts: AlertCounts | null;
  loaded: boolean;
  loading: boolean;
  refreshing: boolean;
  error: { kind: AlertErrorKind; message: string } | null;
  /** Ids con una marca de lectura en curso. */
  marking: string[];
  markError: { alertId: string; kind: AlertErrorKind; message: string } | null;
  /** Alerta abierta en el detalle (datos de la lista). */
  selectedId: string | null;
};

const countsOf = (alerts: PatientAlert[]): AlertCounts => ({
  all: alerts.length,
  open: alerts.filter((a) => a.status === 'OPEN').length,
  read: alerts.filter((a) => a.status === 'READ').length,
});

export function createPatientAlerts(service: AlertsService = backendAlertsService, options: { now?: () => Date } = {}) {
  const now = options.now ?? (() => new Date());
  let state: AlertsState = {
    patientId: null,
    filter: 'ALL',
    items: [],
    counts: null,
    loaded: false,
    loading: false,
    refreshing: false,
    error: null,
    marking: [],
    markError: null,
    selectedId: null,
  };
  let generation = 0;
  /** Lista completa conocida (para el detalle y los contadores). */
  let all: PatientAlert[] = [];
  const inFlight = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();

  const set = (patch: Partial<AlertsState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  async function load(mode: 'initial' | 'refresh'): Promise<void> {
    const { patientId, filter } = state;
    if (!patientId) return;
    const current = ++generation;
    set(
      mode === 'refresh'
        ? { refreshing: true, error: null }
        : { loading: true, error: null, items: [], loaded: false },
    );
    try {
      // Lista completa para los contadores; si hay filtro, el backend filtra.
      const [complete, filtered] = await Promise.all([
        service.list(patientId),
        filter === 'ALL' ? Promise.resolve(null) : service.list(patientId, filter),
      ]);
      if (current !== generation) return;
      all = complete;
      set({
        items: filtered ?? complete,
        counts: countsOf(complete),
        loaded: true,
        loading: false,
        refreshing: false,
      });
    } catch (cause) {
      if (current !== generation) return;
      set({ loading: false, refreshing: false, error: classifyAlertError(cause) });
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

    /** Cambia de paciente: limpia la lista anterior y carga la nueva. */
    setPatient(patientId: string | null): Promise<void> {
      if (patientId === state.patientId) return Promise.resolve();
      generation++;
      all = [];
      inFlight.clear();
      set({
        patientId,
        filter: 'ALL',
        items: [],
        counts: null,
        loaded: false,
        loading: false,
        refreshing: false,
        error: null,
        marking: [],
        markError: null,
        selectedId: null,
      });
      return patientId ? load('initial') : Promise.resolve();
    },

    setFilter(filter: AlertFilter): Promise<void> {
      if (filter === state.filter && state.loaded) return Promise.resolve();
      set({ filter, markError: null });
      return load('initial');
    },

    refresh(): Promise<void> {
      if (!state.patientId || state.loading || state.refreshing) return Promise.resolve();
      return load(state.loaded ? 'refresh' : 'initial');
    },

    /**
     * Marca una alerta como leída. Un segundo toque mientras está en curso
     * reutiliza la misma llamada; una alerta ya leída no se vuelve a enviar.
     */
    markRead(alertId: string): Promise<void> {
      const pending = inFlight.get(alertId);
      if (pending) return pending;
      const alert = all.find((a) => a.id === alertId) ?? state.items.find((a) => a.id === alertId);
      const patientId = state.patientId;
      if (!alert || alert.status === 'READ' || !patientId) return Promise.resolve();

      const current = generation;
      set({ marking: [...state.marking, alertId], markError: null });
      const action = (async () => {
        try {
          await service.markRead(patientId, alertId);
          if (current !== generation) return;
          const readAt = now().toISOString();
          const markReadLocal = (a: PatientAlert): PatientAlert =>
            a.id === alertId ? { ...a, status: 'READ', readAt } : a;
          all = all.map(markReadLocal);
          const items =
            state.filter === 'OPEN'
              ? state.items.filter((a) => a.id !== alertId)
              : state.items.map(markReadLocal);
          set({ items, counts: countsOf(all) });
        } catch (cause) {
          if (current !== generation) return;
          const error = classifyAlertError(cause);
          if (error.kind === 'not_found') {
            // Ya no existe: se quita de la lista y del detalle.
            all = all.filter((a) => a.id !== alertId);
            set({
              items: state.items.filter((a) => a.id !== alertId),
              counts: countsOf(all),
              selectedId: state.selectedId === alertId ? null : state.selectedId,
            });
          }
          set({ markError: { alertId, ...error } });
        } finally {
          inFlight.delete(alertId);
          if (current === generation) set({ marking: state.marking.filter((id) => id !== alertId) });
        }
      })();
      inFlight.set(alertId, action);
      return action;
    },

    /** Detalle con los datos de la lista (el backend no tiene GET individual). */
    open(alertId: string): void {
      set({ selectedId: alertId });
    },
    close(): void {
      set({ selectedId: null });
    },
    selected(): PatientAlert | null {
      if (!state.selectedId) return null;
      return all.find((a) => a.id === state.selectedId) ?? state.items.find((a) => a.id === state.selectedId) ?? null;
    },
  };
}

export type PatientAlertsController = ReturnType<typeof createPatientAlerts>;
