import type { ISODateTime, UUID } from './common';

export type ConsultationStatus = 'DRAFT' | 'FINALIZED';

export type PrescriptionResponse = {
  prescriptionId: UUID;
  consultationId: UUID;
  medicationName: string;
  dose: string;
  frequency: string;
  duration: string | null;
  instructions: string | null;
  createdAt: ISODateTime;
};

export type ClinicalDocumentResponse = {
  documentId: UUID;
  consultationId: UUID;
  patientId: UUID;
  doctorId: UUID;
  originalFilename: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  sizeBytes: number;
  createdAt: ISODateTime;
};

export type ConsultationAddendumResponse = {
  addendumId: UUID;
  consultationId: UUID;
  doctorId: UUID;
  content: string;
  createdAt: ISODateTime;
};

export type MedicalConsultationResponse = {
  consultationId: UUID;
  patientId: UUID;
  doctorId: UUID;
  occurredAt: ISODateTime;
  reason: string;
  clinicalImpression: string | null;
  observations: string | null;
  indications: string | null;
  status: ConsultationStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  finalizedAt: ISODateTime | null;
  prescriptions?: PrescriptionResponse[];
  documents?: ClinicalDocumentResponse[];
  addenda?: ConsultationAddendumResponse[];
};
