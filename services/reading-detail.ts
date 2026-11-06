import { getPatientReading, type ReadingResponse } from './api';
import { ApiError, normalizeApiError } from './errors';

/**
 * Detalle de una lectura: GET /api/v1/patients/{patientId}/readings/{readingId}.
 *
 * - Siempre con el patientId activo y el readingId de la navegación; nunca la
 *   ruta global /readings/{id}.
 * - Sin respaldo silencioso: si el servidor falla, se muestra el error (acceso
 *   denegado, lectura inexistente o error temporal) y no un dato local.
 * - Mientras la lectura está PENDING se vuelve a consultar cada pocos segundos,
 *   con un número máximo de intentos (sin sondeo infinito). Después queda el
 *   botón "Actualizar", que reinicia esos intentos.
 * - No depende de React: la pantalla se suscribe con useSyncExternalStore.
 */

export type ReadingDetail = ReadingResponse;

export type DetailErrorKind = 'session' | 'forbidden' | 'not_found' | 'temporary' | 'missing';

export type DetailError = { kind: DetailErrorKind; message: string };

export type DetailState = {
  patientId: string | null;
  readingId: string | null;
  reading: ReadingDetail | null;
  /** Primera carga (sin lectura visible). */
  loading: boolean;
  /** Consulta manual o automática con la lectura ya visible. */
  refreshing: boolean;
  error: DetailError | null;
  /** Consultas automáticas hechas mientras la lectura sigue PENDING. */
  autoChecks: number;
  /** Hay una consulta automática programada. */
  watching: boolean;
  /** Se agotaron las consultas automáticas y la lectura sigue PENDING. */
  pollExhausted: boolean;
};

export const PENDING_POLL = { intervalMs: 5_000, maxChecks: 6 };

/** Traduce un error del servidor a uno de los casos que muestra la pantalla. */
export function classifyDetailError(cause: unknown): DetailError {
  const error = normalizeApiError(cause, 'No se pudo cargar la lectura.');
  if (error.status === 401) {
    return { kind: 'session', message: 'Tu sesión expiró. Inicia sesión nuevamente para ver esta lectura.' };
  }
  if (error.status === 403 || error.code === 'FORBIDDEN') {
    return {
      kind: 'forbidden',
      message: 'No tienes permiso para ver las lecturas de este paciente. Si acompañas a esta persona, pídele que revise tus permisos.',
    };
  }
  if (error.status === 404 || error.code === 'READING_NOT_FOUND' || error.code === 'RESOURCE_NOT_FOUND') {
    return {
      kind: 'not_found',
      message: 'Esta lectura no existe o no pertenece al paciente seleccionado.',
    };
  }
  return {
    kind: 'temporary',
    message: 'No se pudo conectar con el servicio. Revisa tu conexión e inténtalo nuevamente.',
  };
}

const PARAMETER_NAMES: Record<string, string> = {
  SBP: 'Presión sistólica',
  DBP: 'Presión diastólica',
  HEART_RATE: 'Frecuencia cardíaca',
  GLUCOSE: 'Glucosa',
  WEIGHT: 'Peso',
};

export function parameterName(code: string): string {
  return PARAMETER_NAMES[code] ?? code;
}

/**
 * Texto de un motivo de confirmación. Describe la regla técnica que aplicó el
 * servidor; no es un diagnóstico. Un código desconocido se muestra tal cual.
 */
export function describeConfirmationReason(reason: string): string {
  if (reason.startsWith('UNUSUAL_VALUE:')) {
    const code = reason.slice('UNUSUAL_VALUE:'.length);
    return `${parameterName(code)}: el valor es muy distinto de tus mediciones anteriores.`;
  }
  if (reason === 'SBP_NOT_GREATER_THAN_DBP') {
    return 'La presión sistólica no es mayor que la diastólica. Revisa si los valores quedaron invertidos.';
  }
  return reason;
}

type Fetch = (patientId: string, readingId: string) => Promise<ReadingDetail>;
type Schedule = (run: () => void, ms: number) => () => void;

const defaultSchedule: Schedule = (run, ms) => {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
};

export function createReadingDetail(
  fetchReading: Fetch = getPatientReading,
  options: { schedule?: Schedule; poll?: typeof PENDING_POLL } = {},
) {
  const schedule = options.schedule ?? defaultSchedule;
  const poll = options.poll ?? PENDING_POLL;

  let state: DetailState = {
    patientId: null,
    readingId: null,
    reading: null,
    loading: false,
    refreshing: false,
    error: null,
    autoChecks: 0,
    watching: false,
    pollExhausted: false,
  };
  let generation = 0;
  let cancelTimer: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const set = (patch: Partial<DetailState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  const stopWatching = () => {
    cancelTimer?.();
    cancelTimer = null;
  };

  /** Programa otra consulta solo si la lectura sigue PENDING y quedan intentos. */
  const watchIfPending = () => {
    stopWatching();
    const pending = state.reading?.status === 'PENDING';
    if (!pending) {
      set({ watching: false, pollExhausted: false });
      return;
    }
    if (state.autoChecks >= poll.maxChecks) {
      set({ watching: false, pollExhausted: true });
      return;
    }
    const current = generation;
    cancelTimer = schedule(() => {
      cancelTimer = null;
      if (current !== generation) return;
      set({ autoChecks: state.autoChecks + 1 });
      void fetchNow('auto');
    }, poll.intervalMs);
    set({ watching: true, pollExhausted: false });
  };

  async function fetchNow(mode: 'initial' | 'manual' | 'auto'): Promise<void> {
    const { patientId, readingId } = state;
    if (!patientId || !readingId) return;
    const current = ++generation;
    set(mode === 'initial' ? { loading: true, error: null } : { refreshing: true, error: null });
    try {
      const reading = await fetchReading(patientId, readingId);
      if (current !== generation) return;
      if (reading.readingId !== readingId || reading.patientId !== patientId) {
        throw new ApiError({ code: 'READING_NOT_FOUND', status: 404, message: 'Lectura no encontrada.' });
      }
      set({ reading, loading: false, refreshing: false });
      watchIfPending();
    } catch (cause) {
      if (current !== generation) return;
      const error = classifyDetailError(cause);
      // Si la lectura ya no existe o no hay permiso, no se sigue mostrando la anterior.
      const keep = error.kind === 'temporary' ? state.reading : null;
      stopWatching();
      set({ reading: keep, loading: false, refreshing: false, error, watching: false });
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

    /** Abre una lectura. Si cambia patientId o readingId, se descarta la anterior. */
    open(patientId: string | null, readingId: string | null): Promise<void> {
      if (patientId === state.patientId && readingId === state.readingId && (state.reading || state.loading)) {
        return Promise.resolve();
      }
      generation++;
      stopWatching();
      set({
        patientId,
        readingId,
        reading: null,
        loading: false,
        refreshing: false,
        error: null,
        autoChecks: 0,
        watching: false,
        pollExhausted: false,
      });
      if (!patientId || !readingId) {
        set({
          error: {
            kind: 'missing',
            message: readingId
              ? 'Selecciona en "Mis pacientes" a quién acompañas para ver esta lectura.'
              : 'No se indicó qué lectura abrir.',
          },
        });
        return Promise.resolve();
      }
      return fetchNow('initial');
    },

    /** Actualización manual: consulta ya y reinicia los intentos automáticos. */
    refresh(): Promise<void> {
      if (state.loading || state.refreshing) return Promise.resolve();
      stopWatching();
      set({ autoChecks: 0, pollExhausted: false });
      return fetchNow(state.reading ? 'manual' : 'initial');
    },

    /** Detiene las consultas automáticas (al salir de la pantalla). */
    dispose(): void {
      generation++;
      stopWatching();
      set({ watching: false });
    },
  };
}

export type ReadingDetailController = ReturnType<typeof createReadingDetail>;
