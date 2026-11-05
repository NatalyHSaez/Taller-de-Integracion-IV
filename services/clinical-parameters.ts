import type { ClinicalParameterCode, ClinicalParameterResponse } from '@/types/api';

import { authSession } from './auth-session';
import { dataClient } from './data';
import { ApiError } from './errors';
import { mockApi } from './mocks';

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
 * - En sesión mock se usa exclusivamente el catálogo mock.
 * - La caché es solo en memoria (ver services/data/README.md).
 */

const CATALOG_PATH = '/clinical-parameters';
const LIMITS_PATH = '/parameter-limits';
const CATALOG_CACHE_MS = 10 * 60_000;
const CATALOG_STALE_MS = 60 * 60_000;

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
  return !!value && typeof value === 'object';
}

/** Devuelve el primer campo numérico presente, null si no hay, o undefined si es inválido. */
function pickNumber(
  record: Record<string, unknown>,
  keys: string[],
): number | null | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined) continue;
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }
  return null;
}

function isValidCatalogItem(item: unknown): item is ClinicalParameterResponse {
  if (!isRecord(item)) return false;
  const optionalNumber = (field: unknown) =>
    field === null || field === undefined || typeof field === 'number';

  return (
    typeof item.code === 'string' &&
    typeof item.name === 'string' &&
    typeof item.unit === 'string' &&
    typeof item.valueType === 'string' &&
    optionalNumber(item.technicalMin) &&
    optionalNumber(item.technicalMax)
  );
}

/**
 * Normaliza la respuesta de /parameter-limits.
 * Acepta `minValue`/`maxValue` y, por tolerancia, `min`/`max` o
 * `technicalMin`/`technicalMax`. Descarta ítems incoherentes.
 */
function toLimits(items: unknown): Map<string, NormalizedLimit> {
  if (!Array.isArray(items)) {
    throw invalidResponse('Los límites técnicos tienen un formato inesperado.');
  }

  const limits = new Map<string, NormalizedLimit>();
  for (const item of items) {
    if (!isRecord(item)) continue;
    const code = item.parameterCode ?? item.code;
    if (typeof code !== 'string') continue;

    const min = pickNumber(item, ['minValue', 'min', 'technicalMin']);
    const max = pickNumber(item, ['maxValue', 'max', 'technicalMax']);
    if (min === undefined || max === undefined) continue;
    if (min !== null && max !== null && min > max) continue;
    if (min === null && max === null) continue;

    limits.set(code, {
      min,
      max,
      unit: typeof item.unit === 'string' ? item.unit : null,
    });
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
  for (const item of items) {
    if (!isValidCatalogItem(item)) continue;

    const fromCatalog = {
      min: item.technicalMin ?? null,
      max: item.technicalMax ?? null,
    };
    const fromLimits = limits?.get(item.code);
    const sameUnit = !!fromLimits && (fromLimits.unit === null || fromLimits.unit === item.unit);

    if (fromLimits && !sameUnit && __DEV__) {
      console.warn(
        `[parameter-limits] ${item.code} viene en "${fromLimits.unit}" pero la unidad canónica es "${item.unit}"; se usan los límites de /clinical-parameters.`,
      );
    }

    let effective: { min: number | null; max: number | null };
    let limitsSource: LimitsSource;
    if (fromLimits && sameUnit) {
      effective = fromLimits;
      limitsSource = 'parameter-limits';
    } else if (fromCatalog.min !== null || fromCatalog.max !== null) {
      effective = fromCatalog;
      limitsSource = 'clinical-parameters';
    } else {
      effective = { min: null, max: null };
      limitsSource = 'none';
    }

    catalog[item.code] = {
      ...item,
      technicalMin: effective.min,
      technicalMax: effective.max,
      limitsSource,
    };
  }
  return catalog;
}

const cacheOptions = (forceRefresh?: boolean) => ({
  ttlMs: CATALOG_CACHE_MS,
  staleIfErrorMs: CATALOG_STALE_MS,
  forceRefresh,
});

export const clinicalParametersService = {
  async list(options: { forceRefresh?: boolean } = {}): Promise<ClinicalParameterCatalog> {
    if (authSession.mode() !== 'backend') {
      const [items, limits] = await Promise.all([
        mockApi.catalog.clinicalParameters(),
        mockApi.catalog.parameterLimits(),
      ]);
      return buildCatalog(items, toLimits(limits));
    }

    // El catálogo es obligatorio; los límites son opcionales: si el endpoint
    // falla, se usan los de /clinical-parameters y el backend sigue validando.
    const [items, limits] = await Promise.all([
      dataClient.get<ClinicalParameterResponse[]>(CATALOG_PATH, {
        cache: cacheOptions(options.forceRefresh),
      }),
      dataClient
        .get<unknown>(LIMITS_PATH, { cache: cacheOptions(options.forceRefresh) })
        .then(toLimits)
        .catch((cause: unknown) => {
          if (__DEV__) {
            console.warn('[parameter-limits] No se pudieron cargar; se usa /clinical-parameters.', cause);
          }
          return null;
        }),
    ]);

    return buildCatalog(items, limits);
  },

  invalidate(): void {
    dataClient.invalidate(CATALOG_PATH);
    dataClient.invalidate(LIMITS_PATH);
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
    return `Valor demasiado bajo para ser una medición real. El mínimo aceptado es ${format(min)} ${unit}.`;
  }
  if (max !== null && value > max) {
    return `Valor demasiado alto para ser una medición real. El máximo aceptado es ${format(max)} ${unit}.`;
  }

  return null;
}
