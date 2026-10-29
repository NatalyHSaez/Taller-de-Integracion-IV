import type { ClinicalParameterCode, ClinicalParameterResponse } from '@/types/api';

import { authSession } from './auth-session';
import { dataClient } from './data';
import { ApiError } from './errors';
import { mockApi } from './mocks';

/**
 * Catálogo de parámetros clínicos (GET /api/v1/clinical-parameters).
 *
 * - En sesión backend la única fuente es el Gateway: nunca se completa con mocks.
 * - En sesión mock se usa exclusivamente el catálogo mock.
 * - La caché es solo en memoria (ver services/data/README.md).
 */

const CATALOG_PATH = '/clinical-parameters';
const CATALOG_CACHE_MS = 10 * 60_000;
const CATALOG_STALE_MS = 60 * 60_000;

export type ClinicalParameterCatalog = Partial<
  Record<ClinicalParameterCode, ClinicalParameterResponse>
>;

function isValidItem(item: unknown): item is ClinicalParameterResponse {
  if (!item || typeof item !== 'object') return false;
  const value = item as Record<string, unknown>;
  const optionalNumber = (field: unknown) =>
    field === null || field === undefined || typeof field === 'number';

  return (
    typeof value.code === 'string' &&
    typeof value.name === 'string' &&
    typeof value.unit === 'string' &&
    typeof value.valueType === 'string' &&
    optionalNumber(value.technicalMin) &&
    optionalNumber(value.technicalMax)
  );
}

function toCatalog(items: unknown): ClinicalParameterCatalog {
  if (!Array.isArray(items)) {
    throw new ApiError({
      code: 'INVALID_API_RESPONSE',
      message: 'El catálogo de parámetros clínicos tiene un formato inesperado.',
      details: {},
    });
  }

  const catalog: ClinicalParameterCatalog = {};
  for (const item of items) {
    if (isValidItem(item)) {
      catalog[item.code] = {
        ...item,
        technicalMin: item.technicalMin ?? null,
        technicalMax: item.technicalMax ?? null,
      };
    }
  }
  return catalog;
}

export const clinicalParametersService = {
  async list(options: { forceRefresh?: boolean } = {}): Promise<ClinicalParameterCatalog> {
    if (authSession.mode() !== 'backend') {
      return toCatalog(await mockApi.catalog.clinicalParameters());
    }

    const items = await dataClient.get<ClinicalParameterResponse[]>(CATALOG_PATH, {
      cache: {
        ttlMs: CATALOG_CACHE_MS,
        staleIfErrorMs: CATALOG_STALE_MS,
        forceRefresh: options.forceRefresh,
      },
    });

    return toCatalog(items);
  },

  invalidate(): void {
    dataClient.invalidate(CATALOG_PATH);
  },
};

/**
 * Valida un valor contra los límites técnicos del catálogo.
 * Devuelve un mensaje de error o null si el valor es aceptable.
 * El backend vuelve a validar siempre; esto es solo preventivo.
 */
export function validateAgainstParameter(
  parameter: ClinicalParameterResponse,
  rawValue: string,
): string | null {
  const text = rawValue.trim();
  if (!text) return null;

  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value)) return 'Ingresa un número válido.';

  if (/int/i.test(parameter.valueType) && !Number.isInteger(value)) {
    return 'Debe ser un número entero.';
  }

  const { technicalMin: min, technicalMax: max, unit } = parameter;
  if (min !== null && value < min) return `El mínimo es ${min} ${unit}.`;
  if (max !== null && value > max) return `El máximo es ${max} ${unit}.`;

  return null;
}
