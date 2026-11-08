import type { CreateReadingRequest } from '../../../../core/infrastructure/http/dto';
import { ApiError } from '../../../../core/infrastructure/http/errors';
import { MOCK_CLINICAL_PARAMETERS } from './api-data';

function reject(code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new ApiError({ code, message, details, status: 422 });
}

/**
 * Reproduce en sesión mock las validaciones del POST de lecturas, con los
 * mismos códigos de error que el backend, para probar la interfaz sin servidor.
 */
export function validateMockReading(request: CreateReadingRequest): void {
  if (new Date(request.measuredAt).getTime() > Date.now() + 60_000) {
    reject('FUTURE_DATE', 'La fecha de medición no puede ser futura.');
  }

  const seen = new Set<string>();
  request.measurements.forEach((measurement, index) => {
    const definition = MOCK_CLINICAL_PARAMETERS.find((p) => p.code === measurement.parameterCode);
    if (!definition) {
      reject('UNKNOWN_PARAMETER', 'Parámetro desconocido.', { parameterCode: measurement.parameterCode, index });
    }
    if (seen.has(measurement.parameterCode)) {
      reject('DUPLICATED_PARAMETER', 'Parámetro repetido.', { parameterCode: measurement.parameterCode, index });
    }
    seen.add(measurement.parameterCode);
    if (measurement.unit !== definition.unit) {
      reject('INVALID_UNIT', 'Unidad inválida.', { parameterCode: measurement.parameterCode, unit: definition.unit });
    }
    if (measurement.value < definition.technicalMin || measurement.value > definition.technicalMax) {
      reject('OUT_OF_RANGE', 'Valor fuera de rango.', {
        parameterCode: measurement.parameterCode,
        min: definition.technicalMin,
        max: definition.technicalMax,
        unit: definition.unit,
      });
    }
  });

  if (seen.has('SBP') !== seen.has('DBP')) {
    reject('INCOMPLETE_BLOOD_PRESSURE', 'Falta sistólica o diastólica.');
  }
  if (seen.has('GLUCOSE') && request.context !== 'PREPRANDIAL' && request.context !== 'POSTPRANDIAL') {
    reject('CONTEXT_REQUIRED', 'La glucosa requiere contexto.');
  }
}
