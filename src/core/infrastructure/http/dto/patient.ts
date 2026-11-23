import type { BiologicalSex, ISODate, ISODateTime, PatientManagementMode, UUID } from './common';
import type { LinkCodeType } from './relation';
/** GET /api/v1/me/patients. No incluye sexo, edad ni modalidad. */
export type PatientSummaryResponse = {
  patientId: UUID;
  fullName: string;
  relationshipId: UUID;
  relationshipType: LinkCodeType;
  permissions: string[];
  linkedAt: ISODateTime;
};
/** GET /api/v1/patients/{patientId}. Campos opcionales de perfil pueden ser null. */
export type PatientProfileResponse = {
  id: UUID;
  fullName: string;
  birthDate: ISODate | null;
  age: number | null;
  biologicalSex: BiologicalSex | null;
  managementMode: PatientManagementMode | null;
};
