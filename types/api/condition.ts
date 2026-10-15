import type { ISODate, UUID } from './common';
import type { CanonicalUnit } from './reading';

export type HealthConditionResponse = {
  conditionId: UUID;
  code: string;
  name: string;
  active: boolean;
};

export type ClinicalParameterResponse = {
  parameterId: UUID;
  code: string;
  name: string;
  valueType: string;
  canonicalUnit: CanonicalUnit | null;
  active: boolean;
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
