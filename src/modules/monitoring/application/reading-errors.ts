import type { ClinicalParameterCode, CreateReadingRequest } from '@/src/core/infrastructure/http/dto';

import { ApiError } from '../../../core/infrastructure/http/errors';

/** Lugar del formulario donde se muestra un error del registro de lecturas. */
export type ReadingFormField = ClinicalParameterCode | 'context' | 'measuredAt';

export type ReadingFormErrors = {
  fields: Partial<Record<ReadingFormField, string>>;
  /** Error que no corresponde a un campo concreto (se muestra sobre el botón). */
  general: string | null;
  /** true si el backend rechazó la unidad: conviene recargar el catálogo. */
  unitRejected: boolean;
};

/** Códigos de validación de lecturas definidos por el backend. */
export const READING_ERROR_CODES = [
  'DUPLICATED_PARAMETER',
  'UNKNOWN_PARAMETER',
  'INVALID_UNIT',
  'OUT_OF_RANGE',
  'INCOMPLETE_BLOOD_PRESSURE',
  'CONTEXT_REQUIRED',
  'FUTURE_DATE',
] as const;
export type ReadingErrorCode = (typeof READING_ERROR_CODES)[number];

const PARAMETER_CODES: ClinicalParameterCode[] = ['SBP', 'DBP', 'HEART_RATE', 'GLUCOSE', 'WEIGHT'];

type Issue = {
  code: string | null;
  parameterCode: ClinicalParameterCode | null;
  min: number | null;
  max: number | null;
  unit: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asParameter(value: unknown): ClinicalParameterCode | null {
  return typeof value === 'string' && (PARAMETER_CODES as string[]).includes(value)
    ? (value as ClinicalParameterCode)
    : null;
}

/** Índice de medición desde `index` o desde un `loc` de FastAPI (["body","measurements",1,"value"]). */
function measurementIndex(record: Record<string, unknown>): number | null {
  const direct = asNumber(record.index ?? record.measurementIndex);
  if (direct !== null) return direct;
  const loc = record.loc;
  if (Array.isArray(loc)) {
    const at = loc.indexOf('measurements');
    if (at >= 0) return asNumber(loc[at + 1]);
  }
  return null;
}

function locField(record: Record<string, unknown>): string | null {
  const loc = record.loc ?? record.field;
  if (Array.isArray(loc)) return typeof loc[loc.length - 1] === 'string' ? (loc[loc.length - 1] as string) : null;
  return typeof loc === 'string' ? loc : null;
}

/**
 * El backend actual (domicilia) informa el parámetro solo dentro del texto,
 * por ejemplo "SBP = 400 no es posible (50–300 mmHg)" o "GLUCOSE se registra en
 * mg/dL". Se busca un código que además venga en la lectura enviada.
 */
function parameterInText(text: unknown, request: CreateReadingRequest): ClinicalParameterCode | null {
  if (typeof text !== 'string') return null;
  const sent = new Set(request.measurements.map((m) => m.parameterCode));
  const found = text.match(/\b(SBP|DBP|HEART_RATE|GLUCOSE|WEIGHT)\b/g) ?? [];
  return (found.find((code) => sent.has(code as ClinicalParameterCode)) as ClinicalParameterCode) ?? null;
}

/** Parámetro repetido en la lectura enviada (para DUPLICATED_PARAMETER sin detalle). */
function duplicatedParameter(request: CreateReadingRequest): ClinicalParameterCode | null {
  const seen = new Set<string>();
  for (const { parameterCode } of request.measurements) {
    if (seen.has(parameterCode)) return parameterCode;
    seen.add(parameterCode);
  }
  return null;
}

/** Rango escrito en el texto, por ejemplo "(50–300 mmHg)". */
function rangeInText(text: unknown): { min: number; max: number; unit: string | null } | null {
  if (typeof text !== 'string') return null;
  const match = text.match(/\((-?\d+(?:[.,]\d+)?)\s*[–-]\s*(-?\d+(?:[.,]\d+)?)\s*([^)]*)\)/);
  if (!match) return null;
  const toNumber = (value: string) => Number(value.replace(',', '.'));
  return { min: toNumber(match[1]), max: toNumber(match[2]), unit: match[3].trim() || null };
}

function toIssue(
  record: Record<string, unknown>,
  fallbackCode: string | null,
  request: CreateReadingRequest,
): Issue {
  const rawCode = record.code ?? record.codigo_error ?? record.errorCode ?? record.type;
  const code = typeof rawCode === 'string' && (READING_ERROR_CODES as readonly string[]).includes(rawCode)
    ? rawCode
    : fallbackCode;

  const index = measurementIndex(record);
  const text = record.message ?? record.msg;
  const fromIndex = index !== null ? (request.measurements[index]?.parameterCode ?? null) : null;
  const fromDuplicate = code === 'DUPLICATED_PARAMETER' ? duplicatedParameter(request) : null;
  const parameterCode: ClinicalParameterCode | null =
    asParameter(record.parameterCode ?? record.parameter_code ?? record.parameter) ??
    fromIndex ??
    parameterInText(text, request) ??
    fromDuplicate;

  const ctx = isRecord(record.ctx) ? record.ctx : {};
  const range = rangeInText(text);
  return {
    code,
    parameterCode,
    min: asNumber(record.min ?? record.minValue ?? record.technicalMin ?? ctx.ge ?? ctx.min) ?? range?.min ?? null,
    max: asNumber(record.max ?? record.maxValue ?? record.technicalMax ?? ctx.le ?? ctx.max) ?? range?.max ?? null,
    unit: typeof record.unit === 'string' ? record.unit : range?.unit ?? null,
    ...(code === null && locField(record) === 'context' ? { code: 'CONTEXT_REQUIRED' } : {}),
    ...(code === null && locField(record) === 'measuredAt' ? { code: 'FUTURE_DATE' } : {}),
  };
}

/** Reúne los problemas informados, tanto en un único error como en listas. */
function collectIssues(error: ApiError, request: CreateReadingRequest): Issue[] {
  const topCode = (READING_ERROR_CODES as readonly string[]).includes(error.code) ? error.code : null;
  const details = error.details ?? {};
  const nested = isRecord(details.detail) ? details.detail : {};

  const lists = [details.errors, details.validation, nested.errors, details.detail]
    .filter(Array.isArray)
    .flat()
    .filter(isRecord);

  const issues = lists.map((item) => toIssue(item, topCode, request));
  if (issues.length === 0 || topCode) {
    issues.unshift(
      toIssue({ message: error.message, ...nested, ...details, code: error.code }, topCode, request),
    );
  }
  return issues;
}

function rangeText(issue: Issue): string {
  const unit = issue.unit ? ` ${issue.unit}` : '';
  if (issue.min !== null && issue.max !== null) return ` Rango aceptado: ${issue.min}–${issue.max}${unit}.`;
  if (issue.min !== null) return ` Mínimo aceptado: ${issue.min}${unit}.`;
  if (issue.max !== null) return ` Máximo aceptado: ${issue.max}${unit}.`;
  return '';
}

/**
 * Traduce un error del POST de lecturas a mensajes por campo.
 * Los errores no asociables a un campo quedan en `general`.
 */
export function readingErrorsFromApi(cause: unknown, request: CreateReadingRequest): ReadingFormErrors {
  const result: ReadingFormErrors = { fields: {}, general: null, unitRejected: false };

  if (!(cause instanceof ApiError)) {
    result.general = cause instanceof Error && cause.message
      ? cause.message
      : 'No se pudo registrar la medición. Inténtalo nuevamente.';
    return result;
  }

  const setField = (field: ReadingFormField, message: string) => {
    result.fields[field] ??= message;
  };
  const setParameterOrGeneral = (issue: Issue, message: string) => {
    if (issue.parameterCode) setField(issue.parameterCode, message);
    else result.general ??= message;
  };

  for (const issue of collectIssues(cause, request)) {
    switch (issue.code as ReadingErrorCode | null) {
      case 'OUT_OF_RANGE':
        setParameterOrGeneral(issue, `El servicio rechazó este valor por estar fuera de rango.${rangeText(issue)}`);
        break;
      case 'INVALID_UNIT':
        result.unitRejected = true;
        setParameterOrGeneral(issue, 'La unidad de esta medición no es la que acepta el servicio. Actualizamos el catálogo; revisa y vuelve a guardar.');
        break;
      case 'UNKNOWN_PARAMETER':
        setParameterOrGeneral(issue, 'El servicio no reconoce esta medición. Prueba con otro tipo de medición.');
        break;
      case 'DUPLICATED_PARAMETER':
        setParameterOrGeneral(issue, 'Este valor se envió más de una vez en la misma lectura. Vuelve a guardar.');
        break;
      case 'INCOMPLETE_BLOOD_PRESSURE': {
        const message = 'La presión necesita sistólica y diastólica en la misma lectura.';
        setField('SBP', message);
        setField('DBP', message);
        break;
      }
      case 'CONTEXT_REQUIRED':
        setField('context', 'Indica si la glucosa se midió antes o después de comer.');
        break;
      case 'FUTURE_DATE':
        setField('measuredAt', 'La fecha y hora no pueden ser futuras. Revisa la hora de tu teléfono.');
        break;
      default:
        break;
    }
  }

  if (Object.keys(result.fields).length === 0 && !result.general) {
    result.general = cause.message || 'No se pudo registrar la medición. Inténtalo nuevamente.';
  }
  return result;
}
