import type { ISODateTime, UUID } from './common';

export type CaregiverPermissionCode =
  | 'PATIENT_PROFILE_VIEW'
  | 'MEASUREMENT_CREATE'
  | 'MEASUREMENT_VIEW'
  | 'ALERT_VIEW'
  | 'CLINICAL_VISIT_VIEW'
  | 'PRESCRIPTION_VIEW'
  | 'DOCUMENT_VIEW';

export type DoctorPermissionCode =
  | 'PATIENT_PROFILE_VIEW'
  | 'MEASUREMENT_VIEW'
  | 'ALERT_VIEW'
  | 'CLINICAL_VISIT_VIEW'
  | 'CLINICAL_VISIT_CREATE'
  | 'PRESCRIPTION_CREATE'
  | 'PRESCRIPTION_VIEW'
  | 'DOCUMENT_CREATE'
  | 'DOCUMENT_VIEW';

export type RelationshipStatus = 'ACTIVE' | 'REVOKED';
export type LinkCodeType = 'CAREGIVER' | 'DOCTOR';
export type LinkCodeStatus = 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED';

export type CaregiverRelationshipResponse = {
  relationshipId: UUID;
  caregiverUserId: UUID;
  patientId: UUID;
  status: RelationshipStatus;
  permissions: CaregiverPermissionCode[];
  createdAt: ISODateTime;
  revokedAt: ISODateTime | null;
};

export type DoctorRelationshipResponse = {
  relationshipId: UUID;
  doctorId: UUID;
  doctorUserId: UUID;
  patientId: UUID;
  status: RelationshipStatus;
  permissions: DoctorPermissionCode[];
  createdAt: ISODateTime;
  revokedAt: ISODateTime | null;
};

/**
 * Respuesta provisional al crear un código temporal de vinculación.
 * El backend debe entregar el token al cliente, aunque en BD se almacene solo su hash.
 */
export type LinkCodeResponse = {
  linkCodeId: UUID;
  patientId: UUID;
  linkType: LinkCodeType;
  status: LinkCodeStatus;
  token: string;
  expiresAt: ISODateTime;
};
