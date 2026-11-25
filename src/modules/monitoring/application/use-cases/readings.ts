import type {
  ClinicalParameterCode,
  CreateReadingRequest,
  CreateReadingResponse,
  ReadingContext,
} from '@/src/modules/monitoring/domain/contracts';

import { appState } from '../../../../core/application/session/app-state';
import { authSession } from '../../../../core/application/session/auth-session';
import {
  type ClinicalParameterCatalog,
  parseNumericInput,
  validateAgainstParameter,
} from './clinical-parameters';
import { monitoringRepository } from '../ports/monitoring-port';
import { ApiError, normalizeApiError } from '../../../../core/domain/errors';


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
 * - Sesión backend como cuidador: el paciente elegido en el selector real
 *   (GET /me/patients, core/application/session/app-state.ts).
 */
export function resolveActivePatientId(): string {
  if (authSession.mode() !== 'backend') {
    throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401, message: 'Inicia sesión para registrar mediciones.' });
  }

  const user = authSession.user();
  if (!user) {
    throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401, message: 'Inicia sesión para registrar mediciones.' });
  }
  if (user.roles.includes('PATIENT')) return user.id;

  if (user.roles.includes('CAREGIVER')) {
    const selected = appState.snapshot().selectedPatient;
    if (selected) return selected.id;
    throw new ApiError({
      code: 'PATIENT_REQUIRED',
      message: 'Selecciona en "Mis pacientes" a quién acompañas antes de registrar.',
    });
  }

  throw new ApiError({
    code: 'PATIENT_SELECTION_UNAVAILABLE',
    message: 'Esta cuenta no puede registrar mediciones desde la app.',
  });
}

/** Estados de lectura que informa el backend. */
export type ReadingStatus = 'REQUIRES_CONFIRMATION' | 'PENDING' | 'EVALUATED' | (string & {});

/** Texto neutro para cada estado. No interpreta valores ni da diagnósticos. */
export const READING_STATUS_LABELS: Record<string, { title: string; description: string }> = {
  REQUIRES_CONFIRMATION: {
    title: 'Pendiente de tu confirmación',
    description: 'El servicio no evaluará esta lectura hasta que confirmes que los valores son correctos.',
  },
  PENDING: {
    title: 'Pendiente de evaluación',
    description: 'La lectura quedó registrada. La evaluación se realiza de forma asíncrona y puede tardar unos momentos; el resultado aparecerá en el historial.',
  },
  EVALUATED: {
    title: 'Evaluada',
    description: 'La lectura quedó registrada y el servicio ya la procesó. Puedes revisarla en el historial.',
  },
};

export function readingStatusLabel(status: string | undefined) {
  return (
    READING_STATUS_LABELS[status ?? ''] ?? {
      title: 'Registrada',
      description: 'La lectura quedó registrada en el servicio. Puedes revisarla en el historial.',
    }
  );
}

function toCreateResponse(raw: unknown, expectedReadingId?: string): CreateReadingResponse {
  const value = (raw ?? {}) as Record<string, unknown>;
  if (expectedReadingId && value.readingId === undefined) {
    value.readingId = expectedReadingId;
  }
  if (expectedReadingId && value.readingId !== expectedReadingId) {
    throw new ApiError({
      code: 'INVALID_API_RESPONSE',
      message: 'El servidor respondió con otra lectura. Actualiza el estado antes de continuar.',
    });
  }
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

/**
 * Envíos en curso por clave. Un segundo toque mientras la operación está en
 * curso recibe la misma promesa en vez de repetir el POST.
 */
const inFlight = new Map<string, Promise<CreateReadingResponse>>();

function once(key: string, run: () => Promise<CreateReadingResponse>): Promise<CreateReadingResponse> {
  const current = inFlight.get(key);
  if (current) return current;
  const action = run();
  inFlight.set(key, action);
  const clear = () => {
    if (inFlight.get(key) === action) inFlight.delete(key);
  };
  action.then(clear, clear);
  return action;
}


/** Mensaje y tipo de un error al confirmar una lectura. */
export type ConfirmReadingError = {
  kind: 'not_found' | 'not_pending' | 'other';
  message: string;
};

export function confirmReadingErrorFrom(cause: unknown): ConfirmReadingError {
  const error = normalizeApiError(cause, 'No se pudo confirmar la lectura. Inténtalo nuevamente.');
  if (error.code === 'READING_NOT_FOUND' || (error.status === 404 && error.code === 'RESOURCE_NOT_FOUND')) {
    return {
      kind: 'not_found',
      message: 'No encontramos esta lectura en el servicio. Revisa el historial antes de volver a registrarla.',
    };
  }
  if (error.code === 'READING_NOT_PENDING_CONFIRMATION' || error.status === 409) {
    return {
      kind: 'not_pending',
      message: 'Esta lectura ya no está esperando confirmación (puede que ya se haya confirmado). Actualiza para ver su estado actual.',
    };
  }
  return { kind: 'other', message: error.message };
}

export const readingsService = {
  /** Registra una lectura exclusivamente con POST /patients/{patientId}/readings. */
  create(patientId: string, request: CreateReadingRequest): Promise<CreateReadingResponse> {
    return once('create', async () => {
      if (authSession.mode() !== 'backend') {
        throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401, message: 'Inicia sesión para registrar mediciones.' });
      }
      const raw = await monitoringRepository().createReading(patientId, request);
      return toCreateResponse(raw);
    });
  },

  /**
   * Confirma conscientemente una lectura marcada como inusual:
   * POST /patients/{patientId}/readings/{readingId}/confirm.
   * Tras confirmar, el backend la deja PENDING y la evalúa de forma asíncrona.
   */
  confirm(patientId: string, readingId: string): Promise<CreateReadingResponse> {
    return once(`confirm:${patientId}:${readingId}`, async () => {
      if (authSession.mode() !== 'backend') {
        throw new ApiError({
          code: 'READING_NOT_PENDING_CONFIRMATION',
          status: 409,
          message: 'La lectura no está pendiente de confirmación.',
        });
      }
      const raw = await monitoringRepository().confirmReading(patientId, readingId);
      const result = toCreateResponse(raw, readingId);
      return { ...result, status: result.status ?? 'PENDING' };
    });
  },

  /** Consulta el estado actual de una lectura (sin caché). */
  async status(patientId: string, readingId: string): Promise<CreateReadingResponse> {
    if (authSession.mode() !== 'backend') {
      throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401, message: 'Inicia sesión para consultar la lectura.' });
    }
    const raw = await monitoringRepository().readingStatus(patientId, readingId);
    return toCreateResponse(raw, readingId);
  },
};
