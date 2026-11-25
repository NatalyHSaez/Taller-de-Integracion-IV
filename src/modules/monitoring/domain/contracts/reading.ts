import type { ReadingEvaluation } from '../reading-query';
import type { ISODateTime, UUID } from '@/src/core/domain/contracts/common';

/** Unidades canónicas de los parámetros contemplados por la aplicación. */
export type CanonicalUnit = 'mmHg' | 'mg/dL' | 'bpm' | 'kg';

/** Parámetros clínicos iniciales (HTA, DM2 y peso). */
export type ClinicalParameterCode =
  | 'SBP'
  | 'DBP'
  | 'HEART_RATE'
  | 'GLUCOSE'
  | 'WEIGHT';

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
    unit: string | null;
  }[];
};

/** Respuesta mínima que necesita el flujo de creación/confirmación. */
export type CreateReadingResponse = {
  readingId: UUID;
  status?: string;
  confirmationReasons?: string[];
  evaluation?: ReadingEvaluation | null;
};


export type ReadingStatus = 'PENDING' | 'REQUIRES_CONFIRMATION' | 'EVALUATED';
