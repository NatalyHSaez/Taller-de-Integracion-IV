import type { ReadingResponse, PaginatedReadingsResponse, ReadingsQuery, MeasurementPointResponse, MeasurementsQuery } from '../../domain/reading-query';

export interface ReadingQueryRepository {
  getPatientReading(patientId: string, readingId: string): Promise<ReadingResponse>;
  getPatientReadings(patientId: string, query?: ReadingsQuery): Promise<PaginatedReadingsResponse>;
  getPatientMeasurements(patientId: string, query?: MeasurementsQuery): Promise<MeasurementPointResponse[]>;
}
let repository: ReadingQueryRepository | undefined;
export function configureReadingQueries(value: ReadingQueryRepository): void { repository = value; }
function configured(): ReadingQueryRepository {
  if (!repository) throw new Error('Las consultas de lecturas no están configuradas.');
  return repository;
}
export async function getPatientReading(patientId: string, readingId: string) { return configured().getPatientReading(patientId, readingId); }
export async function getPatientReadings(patientId: string, query: ReadingsQuery = {}) { return configured().getPatientReadings(patientId, query); }
export async function getPatientMeasurements(patientId: string, query: MeasurementsQuery = {}) { return configured().getPatientMeasurements(patientId, query); }
