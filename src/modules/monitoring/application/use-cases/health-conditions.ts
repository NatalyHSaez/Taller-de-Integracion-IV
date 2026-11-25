import { authSession } from '../../../../core/application/session/auth-session';
import { monitoringRepository } from '../ports/monitoring-port';
import { ApiError } from '../../../../core/domain/errors';

/** Catálogo global, independiente de las condiciones asignadas al paciente. */
export type ProgramParameter = {
  code: string;
  /** true si el programa lo exige; false si es opcional. */
  required: boolean;
};

export type HealthProgram = {
  /** Código del programa, identificador estable del catálogo. */
  id: string;
  code: string;
  name: string;
  /**
   * Parámetros que informa el backend para el programa.
   */
  parameters: ProgramParameter[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function invalidCatalog(): ApiError {
  return new ApiError({ code: 'INVALID_API_RESPONSE', message: 'El catálogo de programas tiene un formato inesperado.', details: {} });
}

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** El contrato vigente exige parameters con code y required explícitos. */
function toPrograms(items: unknown): HealthProgram[] {
  if (!Array.isArray(items)) throw invalidCatalog();
  const seen = new Set<string>();
  return items.map((item) => {
    if (!isRecord(item) || !nonEmpty(item.code) || !nonEmpty(item.name) || !Array.isArray(item.parameters) || seen.has(item.code)) throw invalidCatalog();
    seen.add(item.code);
    const parameterCodes = new Set<string>();
    const parameters: ProgramParameter[] = item.parameters.map((entry) => {
      if (!isRecord(entry) || !nonEmpty(entry.code) || typeof entry.required !== 'boolean' || parameterCodes.has(entry.code)) throw invalidCatalog();
      parameterCodes.add(entry.code);
      return { code: entry.code, required: entry.required };
    });
    return { id: item.code, code: item.code, name: item.name, parameters };
  });
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
