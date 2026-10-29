import type { MeasurementResponse, ReadingResponse } from '@/types/api';
import type { Measurement } from '@/types/measurement';

import { authSession } from './auth-session';
import { dataClient } from './data';
import { demo } from './demo-store';
import { ApiError, normalizeApiError } from './errors';

const DETAIL_CACHE_MS = 30_000;
const DETAIL_STALE_MS = 0;

function parameter(
  measurementId: string,
  parameterCode: MeasurementResponse['parameterCode'],
  value: number,
  unit: MeasurementResponse['unit'],
): MeasurementResponse {
  return {
    measurementId,
    parameterCode,
    value,
    unit,
    confirmedByUser: false,
  };
}

function toApiMeasurements(measurement: Measurement): MeasurementResponse[] {
  switch (measurement.type) {
    case 'blood_pressure':
      return [
        parameter(`${measurement.id}-sbp`, 'SBP', measurement.systolic, 'mmHg'),
        parameter(`${measurement.id}-dbp`, 'DBP', measurement.diastolic, 'mmHg'),
        parameter(`${measurement.id}-hr`, 'HEART_RATE', measurement.heartRate, 'bpm'),
      ];
    case 'glucose':
      return [
        parameter(
          measurement.id,
          'GLUCOSE',
          measurement.value,
          measurement.unit,
        ),
      ];
    case 'weight':
      return [parameter(measurement.id, 'WEIGHT', measurement.value, measurement.unit)];
  }
}

/**
 * Construye una lectura desde el estado demo actual.
 *
 * Solo se utiliza en sesiones de demostración; nunca sustituye un error real.
 */
function localReading(patientId: string, readingId: string): ReadingResponse | null {
  const related = demo
    .snapshot()
    .measurements.filter(
      (measurement) =>
        measurement.patientId === patientId && measurement.readingId === readingId,
    );

  const first = related[0];
  if (!first) return null;

  return {
    readingId,
    patientId,
    recordedBy: first.recordedById ?? 'mock-user',
    context: first.context === 'PREPRANDIAL' || first.context === 'POSTPRANDIAL' ? first.context : null,
    measuredAt: first.measuredAt,
    source: 'MOCK',
    status: 'EVALUATED',
    confirmationReasons: [],
    evaluation: null,
    measurements: related.flatMap(toApiMeasurements),
  };
}

export const readingsService = {
  /**
   * Obtiene el detalle de una lectura.
   *
   * En sesión backend usa el detalle real vinculado al paciente autorizado.
   */
  async detail(patientId: string, readingId: string): Promise<ReadingResponse> {
    if (authSession.mode() === 'mock') {
      const local = localReading(patientId, readingId);
      if (local) return local;

      throw new ApiError({
        code: 'RESOURCE_NOT_FOUND',
        message: 'No se encontró la lectura solicitada.',
        details: { readingId, patientId },
        status: 404,
      });
    }

    if (authSession.mode() !== 'backend') {
      throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401,
        message: 'Inicia sesión para consultar una lectura.', details: {} });
    }

    try {
      return await dataClient.get<ReadingResponse>(`/patients/${encodeURIComponent(patientId)}/readings/${encodeURIComponent(readingId)}`, {
        cache: {
          key: `reading-detail:${patientId}:${readingId}`,
          ttlMs: DETAIL_CACHE_MS,
          staleIfErrorMs: DETAIL_STALE_MS,
        },
      });
    } catch (cause) {
      throw normalizeApiError(cause);
    }
  },
};
