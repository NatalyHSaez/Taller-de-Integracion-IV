import type { ReadingResponse, CreateReadingRequest } from '@/src/core/infrastructure/http/dto';
import { apiClient } from '../../../core/infrastructure/http/api-client';
import { dataClient } from '../../../core/infrastructure/http/data';

const catalogCache = (forceRefresh?: boolean) => ({ ttlMs: 600_000, staleIfErrorMs: 3_600_000, forceRefresh });
const readingPath = (patientId: string, readingId?: string) =>
  `/patients/${encodeURIComponent(patientId)}/readings` + (readingId ? `/${encodeURIComponent(readingId)}` : '');

export const monitoringApi = {
  listClinicalParameters: (forceRefresh?: boolean) => dataClient.get<unknown>('/clinical-parameters', { cache: catalogCache(forceRefresh) }),
  listParameterLimits: (forceRefresh?: boolean) => dataClient.get<unknown>('/parameter-limits', { cache: catalogCache(forceRefresh) }),
  listHealthConditions: (forceRefresh?: boolean) => dataClient.get<unknown>('/health-conditions', { cache: catalogCache(forceRefresh) }),
  invalidateClinicalParameters() { dataClient.invalidate('/clinical-parameters'); dataClient.invalidate('/parameter-limits'); },
  invalidateHealthConditions() { dataClient.invalidate('/health-conditions'); },
  createReading: (patientId: string, request: CreateReadingRequest) => apiClient.post<unknown>(readingPath(patientId), request),
  confirmReading: (patientId: string, readingId: string) => apiClient.post<unknown>(`${readingPath(patientId, readingId)}/confirm`, {}),
  readingStatus: (patientId: string, readingId: string) => apiClient.get<unknown>(readingPath(patientId, readingId)),
  readingDetail: (patientId: string, readingId: string) => dataClient.get<ReadingResponse>(readingPath(patientId, readingId), {
    cache: { key: `reading-detail:${patientId}:${readingId}`, ttlMs: 30_000 },
  }),
};
