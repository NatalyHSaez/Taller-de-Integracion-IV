import type { ISODate, UUID } from './common';
import type { CanonicalUnit, ClinicalParameterCode } from './reading';

export type HealthConditionResponse = {
  conditionId: UUID;
  code: string;
  name: string;
  active: boolean;
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

export type PatientConditionResponse = {
  patientConditionId: UUID;
  patientId: UUID;
  conditionId: UUID;
  monitoringProfileId: UUID;
  status: string;
  startedAt: ISODate | null;
  endedAt: ISODate | null;
};
