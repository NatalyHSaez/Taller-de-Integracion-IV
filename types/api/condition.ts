import type { ISODate, UUID } from './common';
import type { CanonicalUnit } from './reading';
/** GET /api/v1/health-conditions: catálogo global (no condiciones asignadas). */
export type HealthConditionResponse = {
  code: string;
  name: string;
  parameters: { code: string; required: boolean }[];
};
/** GET /api/v1/clinical-parameters. */
export type ClinicalParameterResponse = {
  code: string;
  name: string;
  valueType: string;
  unit: CanonicalUnit | null;
  technicalMin: number | null;
  technicalMax: number | null;
};
/** GET /api/v1/parameter-limits. */
export type ParameterLimitResponse = {
  parameterCode: string;
  technicalMin: number | null;
  technicalMax: number | null;
  unit: CanonicalUnit | null;
};
/** PROVISIONAL: la API /patients/{id}/conditions todavía no está implementada. */
export type PatientConditionResponse = {
  patientConditionId: UUID;
  patientId: UUID;
  conditionId: UUID;
  monitoringProfileId: UUID;
  status: string;
  startedAt: ISODate | null;
  endedAt: ISODate | null;
};
