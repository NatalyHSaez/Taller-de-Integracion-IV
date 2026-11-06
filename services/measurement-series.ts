import { getPatientMeasurements, type MeasurementPointResponse, type MeasurementsQuery } from './api';
import { normalizeApiError } from './errors';
import { readingsToMeasurements } from './reading-to-measurements';
import type { Measurement } from '@/types/measurement';

/**
 * Series para gráficos: GET /api/v1/patients/{patientId}/measurements.
 *
 * - Se consulta por parameterCode, from y to. La presión son dos series
 *   (SBP y DBP) que se piden en paralelo y se emparejan por lectura.
 * - Orden cronológico ascendente y unidad tal como la entrega el backend.
 * - El backend excluye las lecturas que esperan confirmación.
 * - Cada resultado guarda la clave de su consulta (paciente, gráfico y rango):
 *   la pantalla nunca muestra una serie de otra consulta. Cambiar de paciente
 *   limpia la caché y descarta respuestas tardías.
 * - No depende de React: la pantalla se suscribe con useSyncExternalStore.
 */

export type ChartKind = 'blood_pressure' | 'heart_rate' | 'glucose' | 'weight';

export const CHARTS: Record<ChartKind, { label: string; codes: string[] }> = {
  blood_pressure: { label: 'Presión', codes: ['SBP', 'DBP'] },
  heart_rate: { label: 'Pulso', codes: ['HEART_RATE'] },
  glucose: { label: 'Glucosa', codes: ['GLUCOSE'] },
  weight: { label: 'Peso', codes: ['WEIGHT'] },
};

export const RANGE_OPTIONS: { days: number | null; label: string }[] = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: null, label: 'Todo' },
];

export const DEFAULT_RANGE_DAYS = 30;

export type SeriesPoint = { readingId: string; measuredAt: string; value: number };

export type Series = {
  parameterCode: string;
  /** Unidad informada por el backend (null si no la envió). */
  unit: string | null;
  points: SeriesPoint[];
};

export type SeriesResult = {
  /** paciente|gráfico|rango: identifica la consulta que produjo la serie. */
  key: string;
  chart: ChartKind;
  from: string | null;
  to: string;
  series: Series[];
};

export type SeriesState = {
  patientId: string | null;
  chart: ChartKind;
  rangeDays: number | null;
  result: SeriesResult | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

type Fetch = typeof getPatientMeasurements;

/** Rango enviado al backend: desde las 00:00 locales de hace (días - 1) días hasta ahora. */
export function rangeFor(days: number | null, now: Date): { from: string | null; to: string } {
  if (days === null) return { from: null, to: now.toISOString() };
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));
  return { from: from.toISOString(), to: now.toISOString() };
}

/** Convierte la respuesta en una serie: solo ese parámetro, valores válidos, orden ascendente. */
export function toSeries(parameterCode: string, points: MeasurementPointResponse[]): Series {
  const own = (Array.isArray(points) ? points : []).filter(
    (point) => point.parameterCode === parameterCode && Number.isFinite(point.value) && !!point.measuredAt,
  );
  const sorted = own
    .map((point, index) => ({ point, index, time: new Date(point.measuredAt).getTime() }))
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(({ point }) => ({ readingId: point.readingId, measuredAt: point.measuredAt, value: point.value }));
  return { parameterCode, unit: own.find((point) => point.unit)?.unit ?? null, points: sorted };
}

/**
 * Presión: solo las lecturas que tienen sistólica y diastólica, en el mismo
 * orden, para que ambas líneas compartan el eje del tiempo.
 */
export function pairBloodPressure(series: Series[]): Series[] {
  const sbp = series.find((s) => s.parameterCode === 'SBP');
  const dbp = series.find((s) => s.parameterCode === 'DBP');
  if (!sbp || !dbp) return series;
  const dbpByReading = new Map(dbp.points.map((point) => [point.readingId, point]));
  const pairedSbp = sbp.points.filter((point) => dbpByReading.has(point.readingId));
  return [
    { ...sbp, points: pairedSbp },
    { ...dbp, points: pairedSbp.map((point) => dbpByReading.get(point.readingId) as SeriesPoint) },
  ];
}

export function createMeasurementSeries(
  fetchPoints: Fetch = getPatientMeasurements,
  options: { now?: () => Date } = {},
) {
  const now = options.now ?? (() => new Date());
  let state: SeriesState = {
    patientId: null,
    chart: 'blood_pressure',
    rangeDays: DEFAULT_RANGE_DAYS,
    result: null,
    loading: false,
    refreshing: false,
    error: null,
  };
  let cache = new Map<string, SeriesResult>();
  let generation = 0;
  const listeners = new Set<() => void>();

  const set = (patch: Partial<SeriesState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  const keyOf = (s: Pick<SeriesState, 'patientId' | 'chart' | 'rangeDays'>) =>
    `${s.patientId}|${s.chart}|${s.rangeDays ?? 'all'}`;

  async function load(mode: 'initial' | 'refresh'): Promise<void> {
    const { patientId, chart, rangeDays } = state;
    if (!patientId) return;
    const current = ++generation;
    const key = keyOf(state);
    const { from, to } = rangeFor(rangeDays, now());
    set(mode === 'refresh' ? { refreshing: true, error: null } : { loading: true, error: null, result: null });
    try {
      const codes = CHARTS[chart].codes;
      const responses = await Promise.all(
        codes.map((parameterCode) => fetchPoints(patientId, { parameterCode, from: from ?? undefined, to })),
      );
      if (current !== generation) return;
      let series = codes.map((code, index) => toSeries(code, responses[index]));
      if (chart === 'blood_pressure') series = pairBloodPressure(series);
      const result: SeriesResult = { key, chart, from, to, series };
      cache.set(key, result);
      set({ result, loading: false, refreshing: false });
    } catch (cause) {
      if (current !== generation) return;
      set({
        loading: false,
        refreshing: false,
        error: normalizeApiError(cause, 'No se pudieron cargar las mediciones.').message,
      });
    }
  }

  /** Cambia la consulta; muestra la caché si existe, si no consulta. */
  function select(patch: Partial<Pick<SeriesState, 'chart' | 'rangeDays'>>): Promise<void> {
    const next = { ...state, ...patch };
    if (keyOf(next) === keyOf(state) && (state.result || state.loading)) return Promise.resolve();
    generation++;
    const cached = cache.get(keyOf(next));
    set({ ...patch, result: cached ?? null, loading: false, refreshing: false, error: null });
    return cached ? Promise.resolve() : load('initial');
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Fija el paciente. Si cambia, invalida la serie previa y la caché. */
    setPatient(patientId: string | null): Promise<void> {
      if (patientId === state.patientId) return Promise.resolve();
      generation++;
      cache = new Map();
      set({ patientId, result: null, loading: false, refreshing: false, error: null });
      return patientId ? load('initial') : Promise.resolve();
    },

    setChart: (chart: ChartKind) => select({ chart }),
    setRange: (rangeDays: number | null) => select({ rangeDays }),

    /** Actualización manual: vuelve a consultar con el "hasta" de ahora. */
    refresh(): Promise<void> {
      if (!state.patientId || state.loading || state.refreshing) return Promise.resolve();
      return load(state.result ? 'refresh' : 'initial');
    },
  };
}

export type MeasurementSeriesController = ReturnType<typeof createMeasurementSeries>;

/** Parámetros que dibuja la pantalla de gráficos (el pulso acompaña a la presión). */
export const CHART_PARAMETER_CODES = ['SBP', 'DBP', 'HEART_RATE', 'GLUCOSE', 'WEIGHT'] as const;

type FetchPoints = (patientId: string, query: MeasurementsQuery) => Promise<MeasurementPointResponse[]>;

/**
 * Mediciones reales para la pantalla de gráficos, en el mismo formato que usa
 * el modo demo (Measurement). Consulta GET /patients/{id}/measurements por
 * cada parameterCode en paralelo y agrupa los puntos por lectura.
 */
export async function loadChartMeasurements(
  patientId: string,
  fetchPoints: FetchPoints = getPatientMeasurements,
): Promise<Measurement[]> {
  const responses = await Promise.all(
    CHART_PARAMETER_CODES.map((parameterCode) => fetchPoints(patientId, { parameterCode })),
  );
  const readings = new Map<string, { readingId: string; measuredAt: string; measurements: { parameterCode: string; value: number }[] }>();
  responses.forEach((points, index) => {
    const code = CHART_PARAMETER_CODES[index];
    for (const point of points ?? []) {
      if (point.parameterCode !== code || !Number.isFinite(point.value) || !point.readingId) continue;
      const reading = readings.get(point.readingId) ?? { readingId: point.readingId, measuredAt: point.measuredAt, measurements: [] };
      reading.measurements.push({ parameterCode: code, value: point.value });
      readings.set(point.readingId, reading);
    }
  });
  return readingsToMeasurements([...readings.values()] as unknown as Parameters<typeof readingsToMeasurements>[0]);
}
