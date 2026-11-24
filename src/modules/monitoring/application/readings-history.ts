import { getPatientReadings } from './reading-query-port';
import type { PaginatedReadingsResponse, ReadingResponse, ReadingsQuery } from '../domain/reading-query';
import { ApiError, getApiErrorMessage } from '../../../core/infrastructure/http/errors';

/**
 * Historial de lecturas del paciente (GET /api/v1/patients/{patientId}/readings).
 *
 * - Pagina con `page`/`size` y filtra con `parameterCode`, `from` y `to`.
 * - Orden: más reciente primero (measuredAt descendente), como el backend.
 * - Sin duplicados ni omisiones al paginar: el límite superior (`to`) se fija
 *   en el momento de pedir la primera página. Así, una lectura registrada
 *   mientras se recorre el historial no desplaza las páginas siguientes; aparece
 *   al actualizar. Además se descartan ids repetidos como resguardo.
 * - Al cambiar de paciente se limpian la caché y los resultados anteriores, y
 *   se ignoran las respuestas que lleguen tarde para el paciente anterior.
 * - No depende de React: la pantalla se suscribe con useSyncExternalStore.
 */

export const HISTORY_PAGE_SIZE = 20;

export type HistoryFilters = {
  /** null = todos los parámetros. */
  parameterCode: string | null;
  /** ISO 8601; null = sin límite inferior. */
  from: string | null;
  /** ISO 8601; null = hasta ahora. */
  to: string | null;
};

export const NO_FILTERS: HistoryFilters = { parameterCode: null, from: null, to: null };

export type HistoryState = {
  patientId: string | null;
  filters: HistoryFilters;
  items: ReadingResponse[];
  /** Total que informa el backend para la consulta actual. */
  total: number;
  /** Última página cargada (0 = ninguna). */
  page: number;
  hasMore: boolean;
  /** Primera carga (sin resultados aún). */
  loading: boolean;
  /** Actualización manual con resultados ya visibles. */
  refreshing: boolean;
  loadingMore: boolean;
  /** Error de la primera página o de una actualización. */
  error: string | null;
  /** Error al pedir la página siguiente (se reintenta con loadMore). */
  loadMoreError: string | null;
};

type FetchPage = (patientId: string, query: ReadingsQuery) => Promise<PaginatedReadingsResponse>;

type CacheEntry = Pick<HistoryState, 'items' | 'total' | 'page' | 'hasMore'> & {
  /** Límite superior fijado al pedir la primera página. */
  upperBound: string;
};

function filtersKey(filters: HistoryFilters): string {
  return `${filters.parameterCode ?? '*'}|${filters.from ?? '*'}|${filters.to ?? '*'}`;
}

function measuredTime(reading: ReadingResponse): number {
  const time = new Date(reading.measuredAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

/** Valida paginación y pertenencia al paciente antes de presentar datos clínicos. */
export function checkHistoryPage(raw: unknown, patientId: string, page: number): PaginatedReadingsResponse {
  const invalid = () => new ApiError({
    code: 'INVALID_API_RESPONSE',
    message: 'El servidor devolvió una página de historial inválida.',
  });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid();
  const value = raw as Record<string, unknown>;
  if (typeof value.total !== 'number' || !Number.isInteger(value.total) || value.total < 0 ||
      value.page !== page || typeof value.size !== 'number' || !Number.isInteger(value.size) ||
      (value.size as number) < 1 || (value.size as number) > 100 ||
      !Array.isArray(value.items) || value.items.length > (value.size as number)) throw invalid();
  const seen = new Set<string>();
  for (const item of value.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid();
    const reading = item as Record<string, unknown>;
    if (reading.patientId !== patientId ||
        typeof reading.readingId !== 'string' || !reading.readingId ||
        seen.has(reading.readingId) ||
        typeof reading.measuredAt !== 'string' || !Number.isFinite(Date.parse(reading.measuredAt)) ||
        !['PENDING', 'REQUIRES_CONFIRMATION', 'EVALUATED'].includes(String(reading.status)) ||
        !Array.isArray(reading.measurements) ||
        !reading.measurements.every((measurement: unknown) => {
          if (!measurement || typeof measurement !== 'object' || Array.isArray(measurement)) return false;
          const m = measurement as Record<string, unknown>;
          return typeof m.parameterCode === 'string' && typeof m.value === 'number' && Number.isFinite(m.value);
        })) throw invalid();
    seen.add(reading.readingId);
  }
  return raw as PaginatedReadingsResponse;
}

/** Une páginas sin repetir lecturas y mantiene el orden más reciente primero. */
export function mergeReadings(current: ReadingResponse[], incoming: ReadingResponse[]): ReadingResponse[] {
  const seen = new Set(current.map((reading) => reading.readingId));
  const merged = [...current];
  for (const reading of incoming) {
    if (seen.has(reading.readingId)) continue;
    seen.add(reading.readingId);
    merged.push(reading);
  }
  // sort es estable: a igual fecha se conserva el orden del servidor.
  return merged.sort((a, b) => measuredTime(b) - measuredTime(a));
}

/** Rango de fechas predefinido para los filtros: últimos N días hasta ahora. */
export function lastDaysRange(days: number, now: Date = new Date()): Pick<HistoryFilters, 'from' | 'to'> {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));
  return { from: from.toISOString(), to: null };
}

export function createReadingsHistory(
  fetchPage: FetchPage = getPatientReadings,
  options: { pageSize?: number; now?: () => Date } = {},
) {
  const pageSize = options.pageSize ?? HISTORY_PAGE_SIZE;
  const now = options.now ?? (() => new Date());

  let state: HistoryState = {
    patientId: null,
    filters: NO_FILTERS,
    items: [],
    total: 0,
    page: 0,
    hasMore: false,
    loading: false,
    refreshing: false,
    loadingMore: false,
    error: null,
    loadMoreError: null,
  };
  let upperBound: string | null = null;
  /** Caché en memoria por combinación de filtros, solo del paciente actual. */
  let cache = new Map<string, CacheEntry>();
  /** Cada consulta nueva invalida las respuestas de consultas anteriores. */
  let generation = 0;
  const listeners = new Set<() => void>();

  const set = (patch: Partial<HistoryState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  const queryFor = (page: number, bound: string): ReadingsQuery => ({
    page,
    size: pageSize,
    parameterCode: state.filters.parameterCode ?? undefined,
    from: state.filters.from ?? undefined,
    to: bound,
  });

  const remember = () => {
    if (!upperBound) return;
    cache.set(filtersKey(state.filters), {
      items: state.items,
      total: state.total,
      page: state.page,
      hasMore: state.hasMore,
      upperBound,
    });
  };

  /** Pide la primera página de la consulta actual (fijando un límite nuevo). */
  async function loadFirstPage(mode: 'initial' | 'refresh'): Promise<void> {
    const patientId = state.patientId;
    if (!patientId) return;
    const current = ++generation;
    const bound = state.filters.to ?? now().toISOString();

    set(
      mode === 'refresh'
        ? { refreshing: true, error: null, loadMoreError: null }
        : { loading: true, error: null, loadMoreError: null, items: [], total: 0, page: 0, hasMore: false },
    );

    try {
      const response = checkHistoryPage(await fetchPage(patientId, queryFor(1, bound)), patientId, 1);
      if (current !== generation) return;
      upperBound = bound;
      const items = mergeReadings([], response.items ?? []);
      set({
        items,
        total: response.total,
        page: 1,
        hasMore: pageSize < response.total,
        loading: false,
        refreshing: false,
      });
      remember();
    } catch (cause) {
      if (current !== generation) return;
      set({
        loading: false,
        refreshing: false,
        error: getApiErrorMessage(cause, 'No se pudo cargar el historial.'),
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

    /**
     * Fija el paciente. Si cambia, limpia caché y resultados y carga desde cero.
     * null deja la lista vacía (por ejemplo, cuidador sin paciente elegido).
     */
    setPatient(patientId: string | null): Promise<void> {
      if (patientId === state.patientId) return Promise.resolve();
      generation++;
      cache = new Map();
      upperBound = null;
      set({
        patientId,
        filters: NO_FILTERS,
        items: [],
        total: 0,
        page: 0,
        hasMore: false,
        loading: false,
        refreshing: false,
        loadingMore: false,
        error: null,
        loadMoreError: null,
      });
      return patientId ? loadFirstPage('initial') : Promise.resolve();
    },

    /** Cambia filtros. Si esa combinación ya se consultó, la muestra desde caché. */
    setFilters(patch: Partial<HistoryFilters>): Promise<void> {
      const filters = { ...state.filters, ...patch };
      if (filtersKey(filters) === filtersKey(state.filters)) return Promise.resolve();
      generation++;
      const cached = cache.get(filtersKey(filters));
      if (cached) {
        upperBound = cached.upperBound;
        set({
          filters,
          items: cached.items,
          total: cached.total,
          page: cached.page,
          hasMore: cached.hasMore,
          loading: false,
          refreshing: false,
          loadingMore: false,
          error: null,
          loadMoreError: null,
        });
        return Promise.resolve();
      }
      upperBound = null;
      set({ filters, loadingMore: false });
      return loadFirstPage('initial');
    },

    /** Actualización manual: vuelve a la página 1 con un límite nuevo. */
    refresh(): Promise<void> {
      if (!state.patientId || state.refreshing) return Promise.resolve();
      return loadFirstPage(state.items.length > 0 ? 'refresh' : 'initial');
    },

    /** Reintenta tras un error de la primera página. */
    retry(): Promise<void> {
      return loadFirstPage('initial');
    },

    /** Pide la página siguiente con el mismo límite superior. */
    async loadMore(): Promise<void> {
      const patientId = state.patientId;
      if (!patientId || !upperBound || !state.hasMore || state.loadingMore || state.loading || state.refreshing) {
        return;
      }
      const current = generation;
      const nextPage = state.page + 1;
      set({ loadingMore: true, loadMoreError: null });
      try {
        const response = checkHistoryPage(await fetchPage(patientId, queryFor(nextPage, upperBound)), patientId, nextPage);
        if (current !== generation) return;
        set({
          items: mergeReadings(state.items, response.items ?? []),
          total: response.total,
          page: nextPage,
          hasMore: nextPage * pageSize < response.total,
          loadingMore: false,
        });
        remember();
      } catch (cause) {
        if (current !== generation) return;
        set({
          loadingMore: false,
          loadMoreError: getApiErrorMessage(cause, 'No se pudieron cargar más lecturas.'),
        });
      }
    },
  };
}

export type ReadingsHistory = ReturnType<typeof createReadingsHistory>;
