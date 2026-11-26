import type { ISODateTime, MeasurementValidationStatus, UUID } from '@/tests/fixtures/contracts/common';
import type { CanonicalUnit, ClinicalParameterCode } from '@/src/modules/monitoring/domain/contracts/reading';

/**
 * Modelo histórico exclusivo de las fixtures de prueba.
 * No debe utilizarse para interpretar directamente MeasurementOut del backend:
 * allí el campo se llama `value` y no `valueNumeric`.
 *
 * No utilizar en producción.
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
 * Lectura LEGADA para los mocks y adaptadores locales de main.
 * El endpoint real utiliza `recordedBy`, `status`, `value` y `evaluation`;
 * véase BackendReadingResponse y `modules/monitoring/infrastructure/readings-api.ts`.
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

