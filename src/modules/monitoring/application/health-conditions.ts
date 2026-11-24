import { authSession } from '../../../core/application/session/auth-session';
import { monitoringRepository } from './monitoring-port';
import { ApiError } from '../../../core/domain/errors';

/**
 * Catálogo global de programas de seguimiento (GET /api/v1/health-conditions).
 *
 * - Es información general del servicio: NO describe condiciones asignadas ni
 *   diagnósticos del paciente.
 * - No se consultan rutas /patients/{id}/conditions: la API de condiciones
 *   asignadas todavía no existe (ver ASSIGNED_CONDITIONS_API_AVAILABLE).
 * - Los datos provienen exclusivamente del Gateway.
 * - La caché es solo en memoria (ver services/data/README.md).
 */


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
      throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401, message: 'Inicia sesión para consultar el servidor.' });
    }

    const items = await monitoringRepository().listHealthConditions(options.forceRefresh);
    return toPrograms(items);
  },

  invalidate(): void {
    monitoringRepository().invalidateHealthConditions();
  },
};
