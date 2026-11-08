import type { ISODate, UUID } from './common';
import type { CanonicalUnit, ClinicalParameterCode } from './reading';

/**
 * Item de GET /api/v1/health-conditions: catálogo GLOBAL de programas de
 * seguimiento (por ejemplo HTA y DM2). No indica qué condiciones tiene un
 * paciente; ese dato requiere una API de condiciones asignadas que aún no existe.
 */
export type HealthConditionResponse = {
  /** El backend actual no lo envía; se conserva por compatibilidad con datos mock. */
  conditionId?: UUID;
  code: string;
  name: string;
  /** El backend solo devuelve condiciones activas, por eso puede omitirlo. */
  active?: boolean;
  /**
   * Parámetros del perfil de seguimiento del programa, tal como los informa el
   * backend: obligatorios (required: true) u opcionales. La app no tiene una
   * relación propia programa-parámetro.
   */
  parameters?: HealthConditionParameter[];
};

export type HealthConditionParameter = {
  code: ClinicalParameterCode;
  required: boolean;
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
