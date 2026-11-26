import type {
  ISODateTime,
  MeasurementValidationStatus,
  UUID,
} from './common';

/** Unidades canónicas definidas para los parámetros iniciales del prototipo. */
export type CanonicalUnit = 'mmHg' | 'mg/dL' | 'bpm' | 'kg';

/** Parámetros clínicos iniciales definidos en la propuesta. */
export type ClinicalParameterCode =
  | 'SBP'
  | 'DBP'
  | 'HEART_RATE'
  | 'GLUCOSE'
  | 'WEIGHT';

/**
 * Medición perteneciente a una lectura.
 * valueText se conserva porque el modelo de seguimiento admite valores
 * numéricos o de texto, aunque los cinco parámetros iniciales son numéricos.
 */
export type MeasurementResponse = {
  measurementId: UUID;
  parameterCode: ClinicalParameterCode;
  valueNumeric: number | null;
  valueText: string | null;
  unit: CanonicalUnit | null;
  validationStatus: MeasurementValidationStatus;
  confirmedByUser: boolean;
};

/**
 * Lectura recibida desde Tracking a través del API Gateway.
 * context y source quedan como string porque la propuesta no enumera todos sus valores.
 */
export type ReadingResponse = {
  readingId: UUID;
  patientId: UUID;
  recordedByUserId: UUID;
  context: string | null;
  measuredAt: ISODateTime;
  source: string;
  measurements: MeasurementResponse[];
};

/** Contexto de una lectura de glucosa exigido por el backend. */
export type ReadingContext = 'PREPRANDIAL' | 'POSTPRANDIAL';

/**
 * Body de POST /api/v1/patients/{patientId}/readings.
 * - measuredAt: ISO 8601 con zona horaria (por ejemplo 2026-11-05T08:30:00-03:00).
 * - context: obligatorio para glucosa; se omite en las demás mediciones.
 * - Sistólica y diastólica viajan siempre juntas en la misma lectura.
 */
export type CreateReadingRequest = {
  measuredAt: ISODateTime;
  source: 'mobile';
  context?: ReadingContext;
  measurements: {
    parameterCode: ClinicalParameterCode;
    value: number;
    unit: CanonicalUnit;
  }[];
};

/**
 * Respuesta de creación. Solo se exigen los campos que la app usa; el resto
 * del ReadingOut del backend se ignora aquí.
 */
export type CreateReadingResponse = {
  readingId: UUID;
  status?: string;
  confirmationReasons?: string[];
};
