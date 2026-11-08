/**
 * Endpoints del microservicio de seguimiento (a través del API Gateway):
 *   GET /patients/{id}/readings, GET /patients/{id}/readings/{readingId},
 *   GET /patients/{id}/measurements
 * El registro y la confirmación de lecturas están en application/readings.ts.
 */
import { apiClient } from "@/src/core/infrastructure/http/api-client";

/* Lecturas del paciente (historial). GET /api/v1/patients/{patientId}/readings */
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

/** Filtros y paginación de GET /patients/{patientId}/readings. */
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

export async function getPatientReadings(
  patientId: string,
  query: ReadingsQuery = {},
): Promise<PaginatedReadingsResponse> {
  return apiClient.get<PaginatedReadingsResponse>(
    `/patients/${encodeURIComponent(patientId)}/readings`,
    {
      query: {
        page: query.page,
        size: query.size,
        parameterCode: query.parameterCode,
        from: query.from,
        to: query.to,
      },
    },
  );
}

/** Punto de GET /patients/{patientId}/measurements (orden cronológico). */
export type MeasurementPointResponse = {
  readingId: string;
  measuredAt: string;
  parameterCode: string;
  value: number;
  unit: string | null;
};

/** Filtros de GET /patients/{patientId}/measurements. */
export type MeasurementsQuery = {
  parameterCode?: string;
  /** measuredAt >= from (ISO 8601). */
  from?: string;
  /** measuredAt <= to (ISO 8601). */
  to?: string;
};

/**
 * Serie de mediciones para gráficos. No incluye lecturas pendientes de
 * confirmación (las excluye el backend).
 */
export async function getPatientMeasurements(
  patientId: string,
  query: MeasurementsQuery = {},
): Promise<MeasurementPointResponse[]> {
  return apiClient.get<MeasurementPointResponse[]>(
    `/patients/${encodeURIComponent(patientId)}/measurements`,
    { query: { parameterCode: query.parameterCode, from: query.from, to: query.to } },
  );
}

/** Una lectura por su id real. GET /api/v1/patients/{patientId}/readings/{readingId} */
export async function getPatientReading(
  patientId: string,
  readingId: string,
): Promise<ReadingResponse> {
  return apiClient.get<ReadingResponse>(
    `/patients/${encodeURIComponent(patientId)}/readings/${encodeURIComponent(readingId)}`,
  );
}
