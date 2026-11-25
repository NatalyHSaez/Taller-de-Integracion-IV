import type { MyPatientResponse, LinkedUserResponse, LinkCodeResponse, ConsumeLinkCodeResponse } from '../../domain/relationships';

export interface RelationshipsRepository {
  getMePatients(): Promise<MyPatientResponse[]>;
  getPatientCaregivers(patientId: string): Promise<LinkedUserResponse[]>;
  getPatientDoctors(patientId: string): Promise<LinkedUserResponse[]>;
  updateCaregiverPermissions(relationshipId: string, permissions: string[]): Promise<LinkedUserResponse>;
  revokeCaregiverRelationship(relationshipId: string): Promise<void>;
  revokeDoctorRelationship(relationshipId: string): Promise<void>;
  createPatientLinkCode(patientId: string, type: 'CAREGIVER' | 'DOCTOR'): Promise<LinkCodeResponse>;
  consumeLinkCode(code: string): Promise<ConsumeLinkCodeResponse>;
}

let repository: RelationshipsRepository | undefined;
export function configureRelationships(value: RelationshipsRepository): void {
  repository = value;
}
export function relationshipsRepository(): RelationshipsRepository {
  if (!repository) throw new Error('El módulo de relaciones no está configurado.');
  return repository;
}
