import type { ISODateTime, ReadingStatus, UUID } from './common';
import type { EvaluationResponse } from './evaluation';
export type CanonicalUnit = 'mmHg' | 'mg/dL' | 'bpm' | 'kg';
export type ClinicalParameterCode = 'SBP' | 'DBP' | 'HEART_RATE' | 'GLUCOSE' | 'WEIGHT';
/** MeasurementOut de Seguimiento. El valor es numérico; NO valueNumeric/valueText. */
export type MeasurementResponse = {
  measurementId: UUID;
  parameterCode: string;
  value: number;
  unit: CanonicalUnit | null;
  confirmedByUser: boolean;
};
/** ReadingOut: GET/POST /patients/{patientId}/readings y GET de detalle. */
export type ReadingResponse = {
  readingId: UUID;
  patientId: UUID;
  measuredAt: ISODateTime;
  context: 'PREPRANDIAL' | 'POSTPRANDIAL' | null;
  source: 'mobile' | 'web' | string;
  status: ReadingStatus;
  recordedBy: UUID;
  confirmationReasons: string[];
  measurements: MeasurementResponse[];
  evaluation: EvaluationResponse | null;
};
export type ReadingPageResponse = {
  total: number;
  page: number;
  size: number;
  items: ReadingResponse[];
};
export type CreateReadingRequest = {
  measuredAt: ISODateTime;
  context?: 'PREPRANDIAL' | 'POSTPRANDIAL' | null;
  source?: 'mobile' | 'web';
  measurements: { parameterCode: string; value: number; unit?: CanonicalUnit | null }[];
};
/** GET /patients/{patientId}/measurements: puntos cronológicos ascendentes. */
export type MeasurementPointResponse = {
  readingId: UUID;
  measuredAt: ISODateTime;
  parameterCode: string;
  value: number;
  unit: CanonicalUnit | null;
};
