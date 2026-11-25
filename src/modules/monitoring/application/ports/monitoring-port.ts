import type { CreateReadingRequest } from '@/src/modules/monitoring/domain/contracts';

export type LinkedPerson = { userId: string; fullName: string };
export interface MonitoringRepository {
  listClinicalParameters(forceRefresh?: boolean): Promise<unknown>;
  listParameterLimits(forceRefresh?: boolean): Promise<unknown>;
  listHealthConditions(forceRefresh?: boolean): Promise<unknown>;
  invalidateClinicalParameters(): void;
  invalidateHealthConditions(): void;
  createReading(patientId: string, request: CreateReadingRequest): Promise<unknown>;
  confirmReading(patientId: string, readingId: string): Promise<unknown>;
  readingStatus(patientId: string, readingId: string): Promise<unknown>;
  listCaregivers(patientId: string): Promise<LinkedPerson[]>;
  listDoctors(patientId: string): Promise<LinkedPerson[]>;
}
let repository: MonitoringRepository | undefined;
export function configureMonitoring(value: MonitoringRepository): void { repository = value; }
export function monitoringRepository(): MonitoringRepository {
  if (!repository) throw new Error('El módulo de seguimiento no está configurado.');
  return repository;
}
