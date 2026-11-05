import type {
  CanonicalUnit,
  ClinicalParameterCode,
  CreateReadingRequest,
  CreateReadingResponse,
  MeasurementResponse,
  ReadingContext,
  ReadingResponse,
} from '@/types/api';
import type { Measurement } from '@/types/measurement';

import { apiClient } from './api';
import { authSession } from './auth-session';
import {
  type ClinicalParameterCatalog,
  parseNumericInput,
  validateAgainstParameter,
} from './clinical-parameters';
import { dataClient } from './data';
import { demo } from './demo-store';
import { ApiError, normalizeApiError } from './errors';
import { validateMockReading } from './mocks/readings-mock';

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

/** Etiquetas del contexto de glucosa para la interfaz. */
export const READING_CONTEXT_LABELS: Record<ReadingContext, string> = {
  PREPRANDIAL: 'Antes de comer o en ayunas',
  POSTPRANDIAL: 'Después de comer',
};

/**
 * Fecha ISO 8601 con la zona horaria local explícita,
 * por ejemplo 2026-11-05T02:36:00-03:00.
 */
export function toIsoWithOffset(date: Date): string {
  const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(offset / 60)}:${pad(offset % 60)}`
  );
}

/**
 * Arma el cuerpo de POST /patients/{patientId}/readings.
 *
 * - La unidad de cada medición es la unidad canónica indicada por la API.
 * - Sistólica y diastólica se envían juntas en la misma lectura.
 * - La glucosa exige contexto PREPRANDIAL o POSTPRANDIAL.
 * - Repite la validación preventiva; el backend vuelve a validar y su
 *   respuesta es la autoridad final.
 */
export function buildCreateReadingRequest(input: {
  codes: ClinicalParameterCode[];
  values: Partial<Record<ClinicalParameterCode, string>>;
  catalog: ClinicalParameterCatalog;
  context: ReadingContext | null;
  measuredAt: Date;
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

  const hasSbp = input.codes.includes('SBP');
  if (hasSbp !== input.codes.includes('DBP')) {
    throw new ApiError({
      code: 'INCOMPLETE_BLOOD_PRESSURE',
      message: 'La presión necesita sistólica y diastólica en la misma lectura.',
      details: {},
    });
  }

  if (input.codes.includes('GLUCOSE') && !input.context) {
    throw new ApiError({
      code: 'CONTEXT_REQUIRED',
      message: 'Indica si la glucosa se midió antes o después de comer.',
      details: {},
    });
  }

  return {
    measuredAt: toIsoWithOffset(input.measuredAt),
    source: 'mobile',
    ...(input.context ? { context: input.context } : {}),
    measurements,
  };
}

/**
 * patientId activo para registrar.
 * - Sesión backend como paciente: su propio id de usuario (sesión).
 * - Sesión backend como cuidador: requiere el selector real de pacientes
 *   vinculados (/me/patients), que aún no está integrado en esta rama; por eso
 *   se bloquea en vez de usar un id local que el backend no reconocería.
 * - Sesión mock: el paciente seleccionado en el selector demo.
 */
export function resolveActivePatientId(): string {
  if (authSession.mode() !== 'backend') {
    const patient = demo.patient();
    if (!patient) {
      throw new ApiError({ code: 'PATIENT_REQUIRED', message: 'Selecciona un paciente antes de registrar.' });
    }
    return patient.id;
  }

  const user = authSession.user();
  if (!user) {
    throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401, message: 'Inicia sesión para registrar mediciones.' });
  }
  if (user.roles.includes('paciente')) return user.id;

  throw new ApiError({
    code: 'PATIENT_SELECTION_UNAVAILABLE',
    message: 'El registro para pacientes vinculados estará disponible cuando se integre la selección de pacientes con el servidor.',
  });
}

function measurementOf<U extends CanonicalUnit>(
  request: CreateReadingRequest,
  code: ClinicalParameterCode,
  unit: U,
): number {
  const item = request.measurements.find((m) => m.parameterCode === code);
  if (!item || item.unit !== unit) {
    throw new ApiError({ code: 'INVALID_UNIT', status: 422, message: 'Unidad no soportada.', details: { parameterCode: code } });
  }
  return item.value;
}

/** Solo sesión mock: convierte la lectura al modelo del almacenamiento demo. */
function toDemoMeasurement(request: CreateReadingRequest): Measurement {
  const base = { id: '', measuredAt: new Date(request.measuredAt).toISOString() };
  const codes = request.measurements.map((m) => m.parameterCode);
  if (codes.includes('SBP')) {
    return {
      ...base,
      type: 'blood_pressure',
      systolic: measurementOf(request, 'SBP', 'mmHg'),
      diastolic: measurementOf(request, 'DBP', 'mmHg'),
      heartRate: measurementOf(request, 'HEART_RATE', 'bpm'),
    };
  }
  if (codes.includes('GLUCOSE')) {
    return {
      ...base,
      type: 'glucose',
      value: measurementOf(request, 'GLUCOSE', 'mg/dL'),
      unit: 'mg/dL',
      context: request.context ? READING_CONTEXT_LABELS[request.context] : undefined,
    };
  }
  return { ...base, type: 'weight', value: measurementOf(request, 'WEIGHT', 'kg'), unit: 'kg' };
}

function toCreateResponse(raw: unknown): CreateReadingResponse {
  const value = (raw ?? {}) as Record<string, unknown>;
  if (typeof value.readingId !== 'string') {
    throw new ApiError({
      code: 'INVALID_API_RESPONSE',
      message: 'El servidor respondió sin identificador de lectura. Revisa el historial antes de volver a intentar.',
    });
  }
  return {
    readingId: value.readingId,
    status: typeof value.status === 'string' ? value.status : undefined,
    confirmationReasons: Array.isArray(value.confirmationReasons)
      ? value.confirmationReasons.filter((r): r is string => typeof r === 'string')
      : undefined,
  };
}

let inFlightCreate: Promise<CreateReadingResponse> | null = null;

export const readingsService = {
  /**
   * Registra una lectura.
   * - Sesión backend: POST /patients/{patientId}/readings. No toca demo-store.
   * - Sesión mock: valida con las mismas reglas y guarda en el almacenamiento
   *   demo, que es la "base de datos" de esa sesión sin servidor.
   * Mientras haya un envío en curso, cualquier llamada adicional reutiliza esa
   * misma promesa: un doble toque no genera un segundo POST.
   */
  create(patientId: string, request: CreateReadingRequest): Promise<CreateReadingResponse> {
    if (inFlightCreate) return inFlightCreate;

    const action = (async () => {
      if (authSession.mode() === 'backend') {
        const raw = await apiClient.post<unknown>(
          `/patients/${encodeURIComponent(patientId)}/readings`,
          request,
        );
        return toCreateResponse(raw);
      }

      validateMockReading(request);
      demo.save(toDemoMeasurement(request));
      return { readingId: `mock-${Date.now()}`, status: 'EVALUATED' };
    })();

    inFlightCreate = action;
    action.then(
      () => { if (inFlightCreate === action) inFlightCreate = null; },
      () => { if (inFlightCreate === action) inFlightCreate = null; },
    );
    return action;
  },

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
