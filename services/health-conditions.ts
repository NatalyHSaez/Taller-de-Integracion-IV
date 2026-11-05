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

export type ProgramParameter = {
  code: string;
  /** true si el programa lo exige; false si es opcional. */
  required: boolean;
};

export type HealthProgram = {
  /** conditionId si el backend lo envía; si no, el código del programa. */
  id: string;
  code: string;
  name: string;
  /**
   * Parámetros que informa el backend para el programa.
   * null significa que el backend no envió esta información.
   */
  parameters: ProgramParameter[] | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

/**
 * Lee los parámetros del programa. El backend envía
 * `parameters: [{ code, required }]`; por tolerancia también se acepta una lista
 * de códigos (se consideran obligatorios) bajo `requiredParameters`,
 * `requiredParameterCodes` o `parameterCodes`.
 */
function readParameters(item: Record<string, unknown>): ProgramParameter[] | null {
  const raw =
    item.parameters ??
    item.requiredParameters ??
    item.requiredParameterCodes ??
    item.parameterCodes;
  if (!Array.isArray(raw)) return null;

  const byCode = new Map<string, ProgramParameter>();
  for (const entry of raw) {
    if (typeof entry === 'string') {
      if (!byCode.has(entry)) byCode.set(entry, { code: entry, required: true });
      continue;
    }
    if (!isRecord(entry)) continue;
    const code = entry.parameterCode ?? entry.code;
    if (typeof code !== 'string' || byCode.has(code)) continue;
    byCode.set(code, { code, required: entry.required !== false });
  }
  return Array.from(byCode.values());
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
    if (typeof code !== 'string' || typeof name !== 'string') continue;
    // Solo se muestran programas vigentes en el catálogo.
    if (active === false) continue;

    programs.push({
      id: typeof conditionId === 'string' ? conditionId : code,
      code,
      name,
      parameters: readParameters(item),
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
