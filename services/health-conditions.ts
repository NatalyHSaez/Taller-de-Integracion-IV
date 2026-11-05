import type { HealthConditionResponse } from '@/types/api';

import { authSession } from './auth-session';
import { dataClient } from './data';
import { ApiError } from './errors';
import { mockApi } from './mocks';

/**
 * Catálogo global de programas de seguimiento (GET /api/v1/health-conditions).
 *
 * - Es información general del servicio: NO describe condiciones asignadas ni
 *   diagnósticos del paciente.
 * - No se consultan rutas /patients/{id}/conditions: la API de condiciones
 *   asignadas todavía no existe (ver ASSIGNED_CONDITIONS_API_AVAILABLE).
 * - En sesión backend la única fuente es el Gateway; en sesión mock, el mock.
 * - La caché es solo en memoria (ver services/data/README.md).
 */

const PATH = '/health-conditions';
const CACHE_MS = 10 * 60_000;
const STALE_MS = 60 * 60_000;

/**
 * Indica si existe una API para consultar las condiciones asignadas al
 * paciente. Mientras sea false, la app no muestra ni supone asignaciones.
 * Al existir el endpoint, se activa aquí y se implementa su servicio.
 */
export const ASSIGNED_CONDITIONS_API_AVAILABLE = false;

export type HealthProgram = {
  conditionId: string;
  code: string;
  name: string;
  /**
   * Códigos de parámetros que informa el backend para el programa.
   * null significa que el backend no envió esta información.
   */
  requiredParameters: string[] | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

/**
 * Lee los parámetros requeridos si el backend los envía. Acepta una lista de
 * códigos o de objetos con `parameterCode`/`code`, bajo `requiredParameters`,
 * `requiredParameterCodes`, `parameterCodes` o `parameters`.
 */
function readRequiredParameters(item: Record<string, unknown>): string[] | null {
  const raw =
    item.requiredParameters ??
    item.requiredParameterCodes ??
    item.parameterCodes ??
    item.parameters;
  if (!Array.isArray(raw)) return null;

  const codes = raw
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (isRecord(entry)) {
        const code = entry.parameterCode ?? entry.code;
        return typeof code === 'string' ? code : null;
      }
      return null;
    })
    .filter((code): code is string => !!code);

  return Array.from(new Set(codes));
}

function toPrograms(items: unknown): HealthProgram[] {
  if (!Array.isArray(items)) {
    throw new ApiError({
      code: 'INVALID_API_RESPONSE',
      message: 'El catálogo de programas tiene un formato inesperado.',
      details: {},
    });
  }

  const programs: HealthProgram[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    const { conditionId, code, name, active } = item;
    if (typeof conditionId !== 'string' || typeof code !== 'string' || typeof name !== 'string') {
      continue;
    }
    // Solo se muestran programas vigentes en el catálogo.
    if (active === false) continue;

    programs.push({
      conditionId,
      code,
      name,
      requiredParameters: readRequiredParameters(item),
    });
  }
  return programs;
}

export const healthConditionsService = {
  async list(options: { forceRefresh?: boolean } = {}): Promise<HealthProgram[]> {
    if (authSession.mode() !== 'backend') {
      return toPrograms(await mockApi.catalog.healthConditions());
    }

    const items = await dataClient.get<HealthConditionResponse[]>(PATH, {
      cache: {
        ttlMs: CACHE_MS,
        staleIfErrorMs: STALE_MS,
        forceRefresh: options.forceRefresh,
      },
    });
    return toPrograms(items);
  },

  invalidate(): void {
    dataClient.invalidate(PATH);
  },
};
