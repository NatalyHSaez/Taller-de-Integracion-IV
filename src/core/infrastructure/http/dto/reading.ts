import type { ISODateTime, ReadingStatus, UUID } from './common';
import type { ReadingContext } from '../../../domain/contracts/reading';
export * from '../../../domain/contracts/reading';
export * from '../../../domain/contracts/legacy-reading';

/** MeasurementOut real de Seguimiento: utiliza `value`, no `valueNumeric`. */
export type BackendMeasurementResponse = {
  measurementId: UUID;
  parameterCode: string;
  value: number;
  unit: string | null;
  confirmedByUser: boolean;
};

/** Evaluación anidada en la respuesta de una lectura; no es el DTO legado de Evaluación. */
export type BackendReadingEvaluationResponse = {
  status: string;
  severity: string | null;
  explanation: string | null;
  evaluatedAt: ISODateTime | null;
};

/**
 * ReadingOut real de GET /patients/{patientId}/readings y GET de detalle.
 * Los campos opcionales son compatibles con la respuesta que ya acepta
 * `src/modules/monitoring/infrastructure/readings-api.ts`.
 */
export type BackendReadingResponse = {
  readingId: UUID;
  patientId: UUID;
  measuredAt: ISODateTime;
  status: ReadingStatus;
  confirmationReasons: string[];
  measurements: BackendMeasurementResponse[];
  context?: ReadingContext | string | null;
  source?: string;
  recordedBy?: UUID;
  evaluation?: BackendReadingEvaluationResponse | null;
};

/** Página real del historial; no contiene lecturas legacy del modo demo. */
export type ReadingPageResponse = {
  total: number;
  page: number;
  size: number;
  items: BackendReadingResponse[];
};

/** Punto de GET /patients/{patientId}/measurements para series cronológicas. */
export type MeasurementPointResponse = {
  readingId: UUID;
  measuredAt: ISODateTime;
  parameterCode: string;
  value: number;
  unit: string | null;
};
