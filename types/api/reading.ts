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

/**
 * Forma documentada para registrar una lectura.
 * Se incluye aquí para que mocks y servicios compartan el mismo contrato.
 */
export type CreateReadingRequest = {
  context: string;
  measuredAt: ISODateTime;
  measurements: Array<{
    parameterCode: ClinicalParameterCode;
    value: number;
    unit: CanonicalUnit;
  }>;
};
