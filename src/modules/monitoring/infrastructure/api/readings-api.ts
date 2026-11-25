import type { ReadingResponse, PaginatedReadingsResponse, ReadingsQuery, MeasurementPointResponse, MeasurementsQuery } from '../../domain/reading-query';
export type { ReadingResponse, PaginatedReadingsResponse, ReadingsQuery, MeasurementPointResponse, MeasurementsQuery } from '../../domain/reading-query';
/**
 * Endpoints del microservicio de seguimiento (a través del API Gateway):
 *   GET /patients/{id}/readings, GET /patients/{id}/readings/{readingId},
 *   GET /patients/{id}/measurements
 * El registro y la confirmación de lecturas están en application/use-cases/readings.ts.
 */
import type { BackendReadingResponse, ReadingPageResponse, MeasurementPointResponse as MeasurementPointDTO } from '../dto/reading';
import { apiClient } from "@/src/core/infrastructure/http/api-client";

/* Lecturas del paciente (historial). GET /api/v1/patients/{patientId}/readings */


/** Filtros y paginación de GET /patients/{patientId}/readings. */

export async function getPatientReadings(
  patientId: string,
  query: ReadingsQuery = {},
): Promise<PaginatedReadingsResponse> {
  return apiClient.get<ReadingPageResponse>(
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

/** Filtros de GET /patients/{patientId}/measurements. */

/**
 * Serie de mediciones para gráficos. No incluye lecturas pendientes de
 * confirmación (las excluye el backend).
 */
export async function getPatientMeasurements(
  patientId: string,
  query: MeasurementsQuery = {},
): Promise<MeasurementPointResponse[]> {
  return apiClient.get<MeasurementPointDTO[]>(
    `/patients/${encodeURIComponent(patientId)}/measurements`,
    { query: { parameterCode: query.parameterCode, from: query.from, to: query.to } },
  );
}

/** Una lectura por su id real. GET /api/v1/patients/{patientId}/readings/{readingId} */
export async function getPatientReading(
  patientId: string,
  readingId: string,
): Promise<ReadingResponse> {
  return apiClient.get<BackendReadingResponse>(
    `/patients/${encodeURIComponent(patientId)}/readings/${encodeURIComponent(readingId)}`,
  );
}
