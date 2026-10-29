import type { ISODateTime, UUID } from './common';
/** Los únicos permisos de cuidador implementados actualmente. */
export type CaregiverPermissionCode =
  | 'PATIENT_PROFILE_VIEW'
  | 'MEASUREMENT_CREATE'
  | 'MEASUREMENT_VIEW'
  | 'ALERT_VIEW';
export type LinkCodeType = 'CAREGIVER' | 'DOCTOR';
/** GET /patients/{id}/caregivers y /doctors: LinkedUserOut. */
export type LinkedUserResponse = {
  relationshipId: UUID;
  userId: UUID;
  fullName: string;
  permissions: string[];
  linkedAt: ISODateTime;
};
export type CaregiverRelationshipResponse = LinkedUserResponse;
export type DoctorRelationshipResponse = LinkedUserResponse;
export type UpdateCaregiverPermissionsRequest = { permissions: CaregiverPermissionCode[] };
/** POST /patients/{id}/link-codes. El QR lleva únicamente code. */
export type CreateLinkCodeRequest = { type: LinkCodeType };
export type LinkCodeResponse = { id: UUID; code: string; type: LinkCodeType; expiresAt: ISODateTime };
export type ConsumeLinkCodeRequest = { code: string };
/** POST /link-codes/consume y PUT /caregiver-relationships/{id}/permissions. */
export type RelationshipResponse = {
  relationshipId: UUID;
  relationshipType: LinkCodeType;
  patientId: UUID;
  patientName: string;
  permissions: string[];
  linkedAt: ISODateTime;
};
