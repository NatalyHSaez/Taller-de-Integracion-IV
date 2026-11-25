/** Resultado clínico informado por el servidor, no calculado por la app. */
export type ReadingEvaluation = {
  status: 'NORMAL' | 'ADVERTENCIA' | 'ALERTA';
  severity: 'BAJA' | 'MEDIA' | 'ALTA' | 'MUY_ALTA' | null;
  explanation: string | null;
  evaluatedAt: string | null;
};

/** El servidor puede procesar una lectura sin reglas aplicables. */
export function isReadingEvaluation(value: unknown): value is ReadingEvaluation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.status === 'string' && ['NORMAL', 'ADVERTENCIA', 'ALERTA'].includes(row.status) &&
    (row.severity === null || (typeof row.severity === 'string' && ['BAJA', 'MEDIA', 'ALTA', 'MUY_ALTA'].includes(row.severity))) &&
    (row.explanation === null || typeof row.explanation === 'string') &&
    (row.evaluatedAt === null || (typeof row.evaluatedAt === 'string' && Number.isFinite(Date.parse(row.evaluatedAt))));
}

export function hasValidReadingEvaluation(status: unknown, evaluation: unknown): boolean {
  return evaluation === undefined || evaluation === null || (status === 'EVALUATED' && isReadingEvaluation(evaluation));
}

export type ReadingResponse = {
  readingId: string;
  patientId: string;
  measuredAt: string;
  status: "PENDING" | "REQUIRES_CONFIRMATION" | "EVALUATED";
  confirmationReasons: string[];
  measurements: {
    measurementId: string;
    parameterCode: string;
    value: number;
    unit: string | null;
    confirmedByUser: boolean;
  }[];
  context?: string | null;
  source?: string;
  recordedBy?: string;
  evaluation?: ReadingEvaluation | null;
};

export type PaginatedReadingsResponse = {
  total: number;
  page: number;
  size: number;
  items: ReadingResponse[];
};

export type ReadingsQuery = {
  /** Página desde 1. */
  page?: number;
  /** Tamaño de página (el backend acepta de 1 a 100; por defecto 20). */
  size?: number;
  /** Solo lecturas que incluyen este parámetro (SBP, GLUCOSE, WEIGHT...). */
  parameterCode?: string;
  /** measuredAt >= from (ISO 8601). */
  from?: string;
  /** measuredAt <= to (ISO 8601). */
  to?: string;
};

export type MeasurementPointResponse = {
  readingId: string;
  measuredAt: string;
  parameterCode: string;
  value: number;
  unit: string | null;
};

export type MeasurementsQuery = {
  parameterCode?: string;
  /** measuredAt >= from (ISO 8601). */
  from?: string;
  /** measuredAt <= to (ISO 8601). */
  to?: string;
};
