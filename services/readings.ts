import type {
  ClinicalParameterCode,
  CreateReadingRequest,
  MeasurementResponse,
  ReadingResponse,
} from '@/types/api';
import type { Measurement } from '@/types/measurement';

import { authSession } from './auth-session';
import {
  type ClinicalParameterCatalog,
  parseNumericInput,
  validateAgainstParameter,
} from './clinical-parameters';
import { dataClient } from './data';
import { demo } from './demo-store';
import { ApiError, normalizeApiError } from './errors';

const DETAIL_CACHE_MS = 30_000;
const DETAIL_STALE_MS = 5 * 60_000;

function parameter(
  measurementId: string,
  parameterCode: MeasurementResponse['parameterCode'],
  valueNumeric: number,
  unit: MeasurementResponse['unit'],
): MeasurementResponse {
  return {
    measurementId,
    parameterCode,
    valueNumeric,
    valueText: null,
    unit,
    validationStatus: 'PLAUSIBLE',
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
 * Esto permite que la pantalla de detalle funcione mientras Integración II aún
 * no expone GET /readings/{readingId}. También cubre mediciones creadas dentro
 * de la propia aplicación durante el desarrollo.
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
    recordedByUserId: first.recordedById ?? 'mock-user',
    context: first.context ?? null,
    measuredAt: first.measuredAt,
    source: authSession.mode() === 'backend' ? 'MOCK_FALLBACK' : 'MOCK',
    measurements: related.flatMap(toApiMeasurements),
  };
}

/**
 * Arma el cuerpo de creación de una lectura (CreateReadingRequest).
 *
 * - La unidad de cada medición es siempre la unidad canónica indicada por la
 *   API en el catálogo; la app no la decide.
 * - Repite la validación preventiva como defensa; el backend vuelve a validar
 *   y su respuesta es la autoridad final.
 */
export function buildCreateReadingRequest(input: {
  codes: ClinicalParameterCode[];
  values: Partial<Record<ClinicalParameterCode, string>>;
  catalog: ClinicalParameterCatalog;
  context: string | null;
  measuredAt: string;
}): CreateReadingRequest {
  const measurements = input.codes.map((code) => {
    const parameter = input.catalog[code];
    if (!parameter) {
      throw new ApiError({
        code: 'PARAMETER_UNAVAILABLE',
        message: 'Este tipo de medición no está disponible en este momento.',
        details: { parameterCode: code },
      });
    }

    const raw = input.values[code] ?? '';
    const problem = validateAgainstParameter(parameter, raw);
    const value = parseNumericInput(raw);
    if (problem || value === null) {
      throw new ApiError({
        code: 'VALIDATION_ERROR',
        message: `${parameter.name}: ${problem ?? 'falta el valor.'}`,
        details: { parameterCode: code },
      });
    }

    return { parameterCode: code, value, unit: parameter.unit };
  });

  return { context: input.context, measuredAt: input.measuredAt, measurements };
}

export const readingsService = {
  /**
   * Obtiene el detalle de una lectura.
   *
   * En sesión backend intenta primero GET /readings/{readingId}. Si el endpoint
   * todavía no está disponible pero la lectura pertenece a los datos locales de
   * desarrollo, usa esa copia para mantener navegable la pantalla.
   */
  async detail(patientId: string, readingId: string): Promise<ReadingResponse> {
    const local = localReading(patientId, readingId);

    if (authSession.mode() !== 'backend') {
      if (local) return local;

      throw new ApiError({
        code: 'RESOURCE_NOT_FOUND',
        message: 'No se encontró la lectura solicitada.',
        details: { readingId, patientId },
        status: 404,
      });
    }

    try {
      return await dataClient.get<ReadingResponse>(`/readings/${readingId}`, {
        cache: {
          key: `reading-detail:${patientId}:${readingId}`,
          ttlMs: DETAIL_CACHE_MS,
          staleIfErrorMs: DETAIL_STALE_MS,
        },
      });
    } catch (cause) {
      // El backend actual de Integración II aún no expone esta ruta. Si la
      // lectura ya existe en el estado demo que alimenta el historial, se usa
      // únicamente como respaldo de desarrollo.
      if (local) return local;
      throw normalizeApiError(cause);
    }
  },
};
