import type { ReadingResponse } from '@/types/api/reading';
import type { ReadingStatus } from '@/types/api/common';
import { ApiError } from './errors';

const STATUSES: ReadingStatus[] = ['PENDING', 'REQUIRES_CONFIRMATION', 'EVALUATED'];
const VALID_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const validDate = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Date.parse(value));
const nullableText = (value: unknown) => value === null || typeof value === 'string';
const invalidResponse = () => new ApiError({
  code: 'INVALID_API_RESPONSE',
  message: 'El servidor devolvió un detalle de lectura inválido.',
});

/** Los UUID reales provienen del backend; evita rutas equivocadas o IDs arbitrarios. */
export function validReadingId(value: unknown): value is string {
  return typeof value === 'string' && VALID_ID.test(value);
}

/** Valida el contrato ReadingOut antes de mostrar información clínica. */
export function checkReadingDetail(value: unknown, patientId: string, readingId: string): ReadingResponse {
  if (!isObject(value) || value.patientId !== patientId || value.readingId !== readingId ||
      !validDate(value.measuredAt) || !STATUSES.includes(value.status as ReadingStatus) ||
      (value.context !== null && value.context !== 'PREPRANDIAL' && value.context !== 'POSTPRANDIAL') ||
      typeof value.source !== 'string' || typeof value.recordedBy !== 'string' ||
      !Array.isArray(value.confirmationReasons) ||
      !value.confirmationReasons.every((reason: unknown) => typeof reason === 'string') ||
      !Array.isArray(value.measurements) || value.measurements.length === 0) {
    throw invalidResponse();
  }
  const measurementIds = new Set<string>();
  for (const item of value.measurements) {
    if (!isObject(item) || typeof item.measurementId !== 'string' || !item.measurementId ||
        measurementIds.has(item.measurementId) || typeof item.parameterCode !== 'string' || !item.parameterCode ||
        typeof item.value !== 'number' || !Number.isFinite(item.value) || !nullableText(item.unit) ||
        typeof item.confirmedByUser !== 'boolean') {
      throw invalidResponse();
    }
    measurementIds.add(item.measurementId);
  }
  if (value.evaluation !== null) {
    if (!isObject(value.evaluation) || typeof value.evaluation.status !== 'string' ||
        !value.evaluation.status || !nullableText(value.evaluation.severity) ||
        !nullableText(value.evaluation.explanation) ||
        (value.evaluation.evaluatedAt !== null && !validDate(value.evaluation.evaluatedAt))) {
      throw invalidResponse();
    }
  }
  return value as ReadingResponse;
}

/** Códigos de confirmación de Integra II: texto entendible, sin crear diagnósticos. */
export function confirmationReasonLabel(reason: string): string {
  if (reason === 'SBP_NOT_GREATER_THAN_DBP') return 'La presión sistólica no supera la diastólica.';
  if (reason.startsWith('UNUSUAL_VALUE:')) {
    const code = reason.slice('UNUSUAL_VALUE:'.length);
    const name: Record<string, string> = {
      SBP: 'presión sistólica', DBP: 'presión diastólica', HEART_RATE: 'frecuencia cardíaca',
      GLUCOSE: 'glucosa', WEIGHT: 'peso',
    };
    return `Se solicita revisar un valor inusual de ${name[code] ?? code}.`;
  }
  return `Motivo comunicado por el servidor: ${reason}`;
}

export function evaluationStatusLabel(status: string): string {
  switch (status) {
    case 'NORMAL': return 'Normal';
    case 'ADVERTENCIA': return 'Advertencia';
    case 'ALERTA': return 'Alerta';
    default: return status;
  }
}
