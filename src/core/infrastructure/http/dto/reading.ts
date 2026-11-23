import type {
  ISODateTime,
  MeasurementValidationStatus,
  ReadingStatus,
  UUID,
} from './common';

/** Unidades canónicas de los parámetros contemplados por la aplicación. */
export type CanonicalUnit = 'mmHg' | 'mg/dL' | 'bpm' | 'kg';

/** Parámetros clínicos iniciales (HTA, DM2 y peso). */
export type ClinicalParameterCode =
  | 'SBP'
  | 'DBP'
  | 'HEART_RATE'
  | 'GLUCOSE'
  | 'WEIGHT';

/**
 * Modelo LEGADO usado por los mocks y por partes del flujo local de main.
 * No debe utilizarse para interpretar directamente MeasurementOut del backend:
 * allí el campo se llama `value` y no `valueNumeric`.
 *
 * Mantener esta estructura mientras los adaptadores y mocks antiguos la utilicen.
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

/** Contexto de una lectura de glucosa para el API Gateway. */
export type ReadingContext = 'PREPRANDIAL' | 'POSTPRANDIAL';

/**
 * Solicitud POST /patients/{patientId}/readings construida por reading-flow.
 * - `measuredAt` incluye zona horaria explícita.
 * - `context` se envía para GLUCOSE.
 * - SBP y DBP se registran juntas.
 * - Unidad y fuente son canónicas; el backend valida nuevamente.
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

/** Respuesta mínima que necesita el flujo de creación/confirmación. */
export type CreateReadingResponse = {
  readingId: UUID;
  status?: string;
  confirmationReasons?: string[];
};

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
