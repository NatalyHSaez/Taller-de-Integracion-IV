import type { ISODate, UUID } from './common';
import type { CanonicalUnit, ClinicalParameterCode } from './reading';

/**
 * Item de GET /api/v1/health-conditions: catálogo GLOBAL de programas de
 * seguimiento (por ejemplo HTA y DM2). No indica qué condiciones tiene un
 * paciente; ese dato requiere una API de condiciones asignadas que aún no existe.
 */
export type HealthConditionResponse = {
  conditionId: UUID;
  code: string;
  name: string;
  active: boolean;
  /**
   * Parámetros que se registran en el programa. Opcional: se usa solo si el
   * backend lo informa; la app no tiene una relación propia programa-parámetro.
   */
  requiredParameters?: ClinicalParameterCode[];
};

/**
 * Item de GET /api/v1/clinical-parameters (contrato real del Gateway).
 * Es la fuente de verdad para nombre, unidad y límites técnicos de cada parámetro.
 */
export type ClinicalParameterResponse = {
  code: ClinicalParameterCode;
  name: string;
  valueType: string;
  unit: CanonicalUnit;
  technicalMin: number | null;
  technicalMax: number | null;
};

/**
 * Item de GET /api/v1/parameter-limits.
 * Límites técnicos (no clínicos) de cada parámetro, expresados en su unidad canónica.
 * Solo sirven para descartar valores imposibles; el backend vuelve a validar siempre.
 */
export type ParameterLimitResponse = {
  parameterCode: ClinicalParameterCode;
  minValue: number | null;
  maxValue: number | null;
  unit: CanonicalUnit;
};

export type PatientConditionResponse = {
  patientConditionId: UUID;
  patientId: UUID;
  conditionId: UUID;
  monitoringProfileId: UUID;
  status: string;
  startedAt: ISODate | null;
  endedAt: ISODate | null;
};
