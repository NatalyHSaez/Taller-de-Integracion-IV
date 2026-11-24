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
  evaluation?: {
    status: string;
    severity: string | null;
    explanation: string | null;
    evaluatedAt: string | null;
  } | null;
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
