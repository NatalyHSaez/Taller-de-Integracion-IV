import type { ReadingPageResponse, ReadingResponse } from '@/types/api/reading';
import type { ReadingStatus } from '@/types/api/common';
import type { Measurement } from '@/types/measurement';
import { ApiError } from './errors';

export const HISTORY_PAGE_SIZE = 20;
export type HistoryFilters = {
  parameterCode?: 'SBP' | 'GLUCOSE' | 'WEIGHT' | 'HEART_RATE';
  from?: string;
  to?: string;
};

const invalidPage = (message: string) => new ApiError({ code: 'INVALID_API_RESPONSE', message });

const STATUSES: ReadingStatus[] = ['PENDING', 'REQUIRES_CONFIRMATION', 'EVALUATED'];

/** Una página inválida no debe confundirse con un historial vacío. */
export function checkHistoryPage(value: unknown, patientId: string, page: number): ReadingPageResponse {
  if (!value || typeof value !== 'object') throw invalidPage('El servidor devolvió un historial inválido.');
  const result = value as ReadingPageResponse;
  if (!Number.isInteger(result.total) || result.total < 0 || result.page !== page ||
      !Number.isInteger(result.size) || result.size < 1 || result.size > 100 ||
      !Array.isArray(result.items) || result.items.length > result.size ||
      result.items.length > result.total) {
    throw invalidPage('El servidor devolvió una página de historial inválida.');
  }
  const found = new Set<string>();
  for (const reading of result.items) {
    if (!reading || reading.patientId !== patientId || typeof reading.readingId !== 'string' ||
        !reading.readingId || found.has(reading.readingId) ||
        !STATUSES.includes(reading.status) ||
        typeof reading.measuredAt !== 'string' || Number.isNaN(Date.parse(reading.measuredAt)) ||
        !Array.isArray(reading.measurements) ||
        !reading.measurements.every((m) => m && typeof m.parameterCode === 'string' &&
          typeof m.value === 'number' && Number.isFinite(m.value))) {
      throw invalidPage('El servidor devolvió una lectura inválida o de otro paciente.');
    }
    found.add(reading.readingId);
  }
  return result;
}

/** El orden del servidor es el de referencia. Un readingId nunca se repite entre páginas. */
export function mergeHistoryPages(previous: ReadingResponse[], incoming: ReadingResponse[]): ReadingResponse[] {
  const seen = new Set<string>();
  return [...previous, ...incoming].filter((reading) => {
    if (seen.has(reading.readingId)) return false;
    seen.add(reading.readingId);
    return true;
  });
}

/** Las fechas introducidas son locales: convertir al inicio/final del día con zona horaria. */
export function localDateRange(from: string, to: string): { from?: string; to?: string } {
  const parse = (raw: string, end: boolean): string | undefined => {
    if (!raw.trim()) return undefined;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
    if (!match) throw new Error('Utiliza fechas con formato AAAA-MM-DD.');
    const [, y, m, d] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d),
      end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
    if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 ||
        date.getDate() !== Number(d)) throw new Error('Una de las fechas ingresadas no existe.');
    return date.toISOString();
  };
  const start = parse(from, false);
  const finish = parse(to, true);
  if (start && finish && start > finish) throw new Error('La fecha desde no puede ser posterior a hasta.');
  return { from: start, to: finish };
}

/** Una tarjeta representa cada parámetro visible, conservando la identidad de su lectura. */
export function historyCards(readings: ReadingResponse[], parameterCode?: HistoryFilters['parameterCode']): Measurement[] {
  return readings.flatMap((reading) => {
    const cards: Measurement[] = [];
    const measurements = new Map(reading.measurements.map((m) => [m.parameterCode, m]));
    const shared = {
      readingId: reading.readingId, patientId: reading.patientId,
      recordedById: reading.recordedBy, measuredAt: reading.measuredAt,
      context: reading.context ?? undefined, readingStatus: reading.status,
    };
    const sbp = measurements.get('SBP');
    const dbp = measurements.get('DBP');
    const pulse = measurements.get('HEART_RATE');
    if ((!parameterCode || parameterCode === 'SBP') && sbp && dbp) {
      cards.push({ ...shared, id: `${reading.readingId}:BP`, type: 'blood_pressure',
        systolic: sbp.value, diastolic: dbp.value, heartRate: pulse?.value });
    } else if (!parameterCode || parameterCode === 'SBP') {
      // No inventar la presión faltante: representar cada valor disponible.
      if (sbp) cards.push({ ...shared, id: `${reading.readingId}:SBP`, type: 'single_pressure',
        parameter: 'SBP', value: sbp.value, unit: 'mmHg' });
      if (dbp) cards.push({ ...shared, id: `${reading.readingId}:DBP`, type: 'single_pressure',
        parameter: 'DBP', value: dbp.value, unit: 'mmHg' });
    }
    if (pulse && (parameterCode === 'HEART_RATE' || (!parameterCode && !(sbp && dbp)))) cards.push({ ...shared, id: `${reading.readingId}:HR`,
      type: 'heart_rate', value: pulse.value, unit: 'bpm' });
    const glucose = measurements.get('GLUCOSE');
    if (glucose && (!parameterCode || parameterCode === 'GLUCOSE')) cards.push({ ...shared, id: `${reading.readingId}:GLUCOSE`,
      type: 'glucose', value: glucose.value, unit: 'mg/dL' });
    const weight = measurements.get('WEIGHT');
    if (weight && (!parameterCode || parameterCode === 'WEIGHT')) cards.push({ ...shared, id: `${reading.readingId}:WEIGHT`,
      type: 'weight', value: weight.value, unit: 'kg' });
    return cards;
  });
}

/**
 * Regla de presentación móvil: no existe registro independiente de pulso.
 * La frecuencia cardíaca se conserva como dato asociado a presión arterial.
 * No modifica la respuesta ni el contrato de Integra II.
 */
export function withoutStandalonePulse(measurements: Measurement[]): Measurement[] {
  return measurements.filter((measurement) => measurement.type !== 'heart_rate');
}
