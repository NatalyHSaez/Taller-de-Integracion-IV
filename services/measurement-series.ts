import type { MeasurementPointResponse } from '@/types/api/reading';
import type { Measurement } from '@/types/measurement';
import { authSession } from './auth-session';
import { appState } from './app-state';
import { dataClient } from './data';
import { ApiError, normalizeApiError } from './errors';
import { validReadingId } from './reading-detail';

export type SeriesCode = 'SBP' | 'DBP' | 'HEART_RATE' | 'GLUCOSE' | 'WEIGHT';
export type SeriesFilters = { from?: string; to?: string };
export type ChartGroup = 'blood_pressure' | 'glucose' | 'weight';
export const SERIES_CODES: Record<ChartGroup, readonly SeriesCode[]> = {
  blood_pressure: ['SBP', 'DBP'], glucose: ['GLUCOSE'], weight: ['WEIGHT'],
};
const UNIT: Record<SeriesCode, string> = {
  SBP: 'mmHg', DBP: 'mmHg', HEART_RATE: 'bpm', GLUCOSE: 'mg/dL', WEIGHT: 'kg',
};
const validIso = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) &&
  /(Z|[+-]\d{2}:\d{2})$/i.test(s) && Number.isFinite(Date.parse(s));
// Los mocks guardan fechas locales sin zona, distinto al contrato real.
const validDemoDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && Number.isFinite(Date.parse(s));
const invalid = () => new ApiError({ code: 'INVALID_API_RESPONSE', message: 'El servidor devolvió una serie de mediciones inválida.' });

/** Valida puntos del Gateway, conserva su lectura original y no inventa valores. */
export function checkMeasurementSeries(raw: unknown, code: SeriesCode, filters: SeriesFilters = {}): MeasurementPointResponse[] {
  if (!Array.isArray(raw)) throw invalid();
  const unique = new Set<string>();
  const result: MeasurementPointResponse[] = [];
  for (const point of raw) {
    if (!point || typeof point !== 'object' || !validReadingId(point.readingId) ||
        !validIso(point.measuredAt) || point.parameterCode !== code ||
        typeof point.value !== 'number' || !Number.isFinite(point.value) ||
        (point.unit !== null && point.unit !== UNIT[code])) throw invalid();
    if ((filters.from && Date.parse(point.measuredAt) < Date.parse(filters.from)) ||
        (filters.to && Date.parse(point.measuredAt) > Date.parse(filters.to))) throw invalid();
    // No agregar duplicados exactos; dos valores distintos para la misma lectura son inválidos.
    const key = `${point.readingId}:${point.parameterCode}`;
    if (unique.has(key)) throw invalid();
    unique.add(key);
    result.push({ readingId: point.readingId, measuredAt: point.measuredAt,
      parameterCode: point.parameterCode, value: point.value, unit: point.unit });
  }
  return result.sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt));
}

/** Agrupa las respuestas sin interpolar valores de sistólica y diastólica ausentes. */
export function mergeMeasurementSeries(parts: MeasurementPointResponse[][]): MeasurementPointResponse[] {
  return parts.flat().sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt) ||
    a.parameterCode.localeCompare(b.parameterCode));
}

/** Los gráficos demo leen SOLO el registro de demostración del frontend, nunca la API. */
export function demoMeasurementSeries(measurements: Measurement[], patientId: string, group: ChartGroup,
  filters: SeriesFilters = {}): MeasurementPointResponse[] {
  const allowed = new Set<string>(SERIES_CODES[group]);
  const output: MeasurementPointResponse[] = [];
  function append(measurement: Measurement, code: SeriesCode, value: number, unit: string) {
    if (!allowed.has(code) || !validDemoDate(measurement.measuredAt)) return;
    const t = Date.parse(measurement.measuredAt);
    if (filters.from && t < Date.parse(filters.from)) return;
    if (filters.to && t > Date.parse(filters.to)) return;
    output.push({ readingId: measurement.readingId ?? measurement.id, measuredAt: measurement.measuredAt,
      parameterCode: code, value, unit: unit as MeasurementPointResponse['unit'] });
  }
  for (const m of measurements) {
    if (m.patientId && m.patientId !== patientId) continue;
    if (m.type === 'blood_pressure') {
      append(m, 'SBP', m.systolic, 'mmHg'); append(m, 'DBP', m.diastolic, 'mmHg');
      // La frecuencia cardíaca forma parte de presión, no es una categoría propia en los gráficos.
    } else if (m.type === 'single_pressure') append(m, m.parameter, m.value, 'mmHg');
    else if (m.type === 'glucose') append(m, 'GLUCOSE', m.value, m.unit);
    else if (m.type === 'weight') append(m, 'WEIGHT', m.value, m.unit);
  }
  return output.sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt));
}

/** Solo sesiones backend con autorización MEASUREMENT_VIEW. Sin fallback a demos. */
export const measurementSeriesService = {
  async list(patientId: string, group: ChartGroup, filters: SeriesFilters = {}, forceRefresh = false): Promise<MeasurementPointResponse[]> {
    if (authSession.mode() !== 'backend' || !authSession.user()) {
      throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401,
        message: 'Inicia sesión con el backend para consultar gráficos reales.' });
    }
    const state = appState.snapshot();
    if (state.user?.source !== 'backend' || state.selectedPatient?.id !== patientId || !state.permissions.read) {
      throw new ApiError({ code: 'FORBIDDEN', status: 403,
        message: 'No tienes permiso para ver las mediciones de este paciente.' });
    }
    if (!validReadingId(patientId) || !Object.prototype.hasOwnProperty.call(SERIES_CODES, group) ||
        (filters.from && !validIso(filters.from)) || (filters.to && !validIso(filters.to)) ||
        (filters.from && filters.to && Date.parse(filters.from) > Date.parse(filters.to))) {
      throw new ApiError({ code: 'INVALID_SERIES_FILTERS', status: 422,
        message: 'El paciente o el rango de fechas no es válido.' });
    }
    const generation = authSession.generation();
    const path = `/patients/${encodeURIComponent(patientId)}/measurements`;
    const latestAccess = () => {
      const current = appState.snapshot();
      return authSession.generation() === generation && authSession.mode() === 'backend' &&
        current.user?.source === 'backend' && current.selectedPatient?.id === patientId && current.permissions.read;
    };
    const codes = SERIES_CODES[group];
    try {
      const parts = await Promise.all(codes.map(async (code) => {
        const query = { parameterCode: code, ...filters };
        const response = await dataClient.get<unknown>(path, {
          query, retry: false, cache: { ttlMs: 15_000, staleIfErrorMs: 0, forceRefresh },
        });
        if (!latestAccess()) throw new ApiError({ code: 'SESSION_CHANGED',
          message: 'Cambió la sesión o el paciente. Actualiza los gráficos.' });
        try {
          return checkMeasurementSeries(response, code, filters);
        } catch (cause) {
          dataClient.invalidate(path, query);
          throw cause;
        }
      }));
      if (!latestAccess()) throw new ApiError({ code: 'SESSION_CHANGED',
        message: 'Cambió la sesión o el paciente. Actualiza los gráficos.' });
      return mergeMeasurementSeries(parts);
    } catch (cause) { throw normalizeApiError(cause); }
  },
};
