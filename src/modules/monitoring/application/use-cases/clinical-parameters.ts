import type { ClinicalParameterCode, ClinicalParameterResponse } from '@/src/modules/monitoring/domain/contracts';

import { authSession } from '../../../../core/application/session/auth-session';
import { monitoringRepository } from '../ports/monitoring-port';
import { ApiError } from '../../../../core/domain/errors';

/**
 * Catálogo de parámetros clínicos con sus límites técnicos efectivos.
 *
 * Fuentes:
 * - GET /api/v1/clinical-parameters: nombre, tipo de valor y unidad canónica.
 * - GET /api/v1/parameter-limits: límites técnicos (mínimo y máximo).
 *
 * Regla de fuente única efectiva (por parámetro):
 * 1. Si /parameter-limits trae el parámetro en la misma unidad canónica,
 *    sus límites reemplazan a los de /clinical-parameters.
 * 2. Si no lo trae, viene en otra unidad o el endpoint falla, se usan los
 *    límites de /clinical-parameters como respaldo.
 * Nunca se mezclan límites de ambas fuentes en un mismo parámetro, y la app no
 * define límites propios: si ninguna fuente los trae, no se valida rango.
 *
 * Estos límites son técnicos (descartan valores imposibles). La app no
 * implementa umbrales clínicos ni diagnósticos, y el backend sigue siendo la
 * autoridad final de validación.
 *
 * - En sesión backend la única fuente es el Gateway: nunca se completa con mocks.
 * - La caché es solo en memoria (ver src/core/infrastructure/http/data).
 */


/** De dónde salen los límites efectivos de un parámetro. */
export type LimitsSource = 'parameter-limits' | 'clinical-parameters' | 'none';

/**
 * Parámetro listo para usar en la app. `technicalMin`/`technicalMax` contienen
 * siempre los límites efectivos según la regla anterior.
 */
export type EffectiveParameter = ClinicalParameterResponse & {
  limitsSource: LimitsSource;
};

export type ClinicalParameterCatalog = Partial<
  Record<ClinicalParameterCode, EffectiveParameter>
>;

type NormalizedLimit = {
  min: number | null;
  max: number | null;
  unit: string | null;
};

function invalidResponse(message: string): ApiError {
  return new ApiError({ code: 'INVALID_API_RESPONSE', message, details: {} });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const supportedCodes = new Set<string>(['SBP', 'DBP', 'HEART_RATE', 'GLUCOSE', 'WEIGHT']);
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const nullableNumber = (value: unknown): value is number | null => value === null || (typeof value === 'number' && Number.isFinite(value));
const nullableUnit = (value: unknown): value is string | null => value === null || nonEmpty(value);

function readBounds(item: Record<string, unknown>): { min: number | null; max: number | null } {
  const min = item.technicalMin;
  const max = item.technicalMax;
  if (!nullableNumber(min) || !nullableNumber(max) || (min !== null && max !== null && min > max)) {
    throw invalidResponse('El servidor entregó límites técnicos inválidos.');
  }
  return { min, max };
}

/** Contrato vigente: parameterCode, technicalMin, technicalMax y unit. */
function toLimits(items: unknown): Map<string, NormalizedLimit> {
  if (!Array.isArray(items)) throw invalidResponse('Los límites técnicos tienen un formato inesperado.');
  const limits = new Map<string, NormalizedLimit>();
  for (const item of items) {
    if (!isRecord(item) || !nonEmpty(item.parameterCode) || !nullableUnit(item.unit) || limits.has(item.parameterCode)) {
      throw invalidResponse('El servidor entregó límites técnicos inválidos o duplicados.');
    }
    const bounds = readBounds(item);
    limits.set(item.parameterCode, { ...bounds, unit: item.unit });
  }
  return limits;
}

function buildCatalog(
  items: unknown,
  limits: Map<string, NormalizedLimit> | null,
): ClinicalParameterCatalog {
  if (!Array.isArray(items)) {
    throw invalidResponse('El catálogo de parámetros clínicos tiene un formato inesperado.');
  }

  const catalog: ClinicalParameterCatalog = {};
  const seen = new Set<string>();
  for (const item of items) {
    if (!isRecord(item) || !nonEmpty(item.code) || !nonEmpty(item.name) || !nonEmpty(item.valueType) || !nullableUnit(item.unit) || seen.has(item.code)) {
      throw invalidResponse('El servidor entregó parámetros clínicos inválidos o duplicados.');
    }
    seen.add(item.code);
    const fromCatalog = readBounds(item);
    // El catálogo puede crecer; el formulario solo implementa estos cinco códigos.
    if (!supportedCodes.has(item.code)) continue;
    const code = item.code as ClinicalParameterCode;
    const fromLimits = limits?.get(code);
    const sameUnit = !!fromLimits && fromLimits.unit === item.unit;

    if (fromLimits && !sameUnit && __DEV__) {
      console.warn(
        `[parameter-limits] ${item.code} viene en "${fromLimits.unit}" pero la unidad canónica es "${item.unit}"; se usan los límites de /clinical-parameters.`,
      );
    }

    let effective: { min: number | null; max: number | null };
    let limitsSource: LimitsSource;
    if (fromLimits && sameUnit && (fromLimits.min !== null || fromLimits.max !== null)) {
      effective = fromLimits;
      limitsSource = 'parameter-limits';
    } else if (fromCatalog.min !== null || fromCatalog.max !== null) {
      effective = fromCatalog;
      limitsSource = 'clinical-parameters';
    } else {
      effective = { min: null, max: null };
      limitsSource = 'none';
    }

    catalog[code] = {
      code, name: item.name, valueType: item.valueType, unit: item.unit,
      technicalMin: effective.min,
      technicalMax: effective.max,
      limitsSource,
    };
  }
  return catalog;
}


export const clinicalParametersService = {
  async list(options: { forceRefresh?: boolean } = {}): Promise<ClinicalParameterCatalog> {
    if (authSession.mode() !== 'backend') {
      throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401, message: 'Inicia sesión para consultar el servidor.' });
    }

    // El catálogo es obligatorio; los límites son opcionales: si el endpoint
    // falla, se usan los de /clinical-parameters y el backend sigue validando.
    const [items, limits] = await Promise.all([
      monitoringRepository().listClinicalParameters(options.forceRefresh),
      monitoringRepository().listParameterLimits(options.forceRefresh)
        .then(toLimits)
        .catch((cause: unknown) => {
          if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) throw cause;
          if (__DEV__) {
            console.warn('[parameter-limits] No se pudieron cargar; se usa /clinical-parameters.', cause);
          }
          return null;
        }),
    ]);

    return buildCatalog(items, limits);
  },

  invalidate(): void {
    monitoringRepository().invalidateClinicalParameters();
  },
};

/** Número escrito por la persona: dígitos con signo y decimal opcional (punto o coma). */
const NUMERIC_INPUT = /^[+-]?\d+(?:[.,]\d+)?$/;

/** Convierte el texto de un campo en número, o null si no es un número válido. */
export function parseNumericInput(rawValue: string): number | null {
  const text = rawValue.trim();
  if (!NUMERIC_INPUT.test(text)) return null;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/**
 * Valida un valor contra los límites técnicos efectivos del parámetro.
 * Devuelve un mensaje de error o null si el valor es aceptable (o está vacío).
 * El backend vuelve a validar siempre; esto es solo preventivo.
 */
export function validateAgainstParameter(
  parameter: ClinicalParameterResponse,
  rawValue: string,
): string | null {
  if (!rawValue.trim()) return null;

  const value = parseNumericInput(rawValue);
  if (value === null) return 'Ingresa solo números, por ejemplo 120 o 72,5.';

  if (/int/i.test(parameter.valueType) && !Number.isInteger(value)) {
    return 'Debe ser un número entero, sin decimales.';
  }

  const { technicalMin: min, technicalMax: max, unit } = parameter;
  const format = (n: number) => String(n).replace('.', ',');
  if (min !== null && value < min) {
    return `Valor demasiado bajo para ser una medición real. El mínimo aceptado es ${format(min)}${unit ? ` ${unit}` : ""}.`;
  }
  if (max !== null && value > max) {
    return `Valor demasiado alto para ser una medición real. El máximo aceptado es ${format(max)}${unit ? ` ${unit}` : ""}.`;
  }

  return null;
}
