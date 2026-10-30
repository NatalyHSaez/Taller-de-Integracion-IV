import type { MeasurementResponse, ReadingPageResponse, ReadingResponse } from '@/types/api';
import type { HistoryFilters } from './readings-history';
import { checkHistoryPage, HISTORY_PAGE_SIZE } from './readings-history';
import { checkReadingDetail, validReadingId } from './reading-detail';
import { appState } from './app-state';
import type { Measurement } from '@/types/measurement';

import { authSession } from './auth-session';
import { dataClient } from './data';
import { demo } from './demo-store';
import { ApiError, normalizeApiError } from './errors';

const DETAIL_CACHE_MS = 30_000;

function parameter(
  measurementId: string,
  parameterCode: MeasurementResponse['parameterCode'],
  value: number,
  unit: MeasurementResponse['unit'],
): MeasurementResponse {
  return {
    measurementId,
    parameterCode,
    value,
    unit,
    confirmedByUser: false,
  };
}

function toApiMeasurements(measurement: Measurement): MeasurementResponse[] {
  switch (measurement.type) {
    case 'blood_pressure':
      return [
        parameter(`${measurement.id}-sbp`, 'SBP', measurement.systolic, 'mmHg'),
        parameter(`${measurement.id}-dbp`, 'DBP', measurement.diastolic, 'mmHg'),
        ...(measurement.heartRate == null ? [] : [parameter(`${measurement.id}-hr`, 'HEART_RATE', measurement.heartRate, 'bpm')]),
      ];
    case 'single_pressure':
      return [parameter(measurement.id, measurement.parameter, measurement.value, 'mmHg')];
    case 'heart_rate':
      return [parameter(measurement.id, 'HEART_RATE', measurement.value, 'bpm')];
    case 'glucose':
      return [
        parameter(
          measurement.id,
          'GLUCOSE',
          measurement.value,
          measurement.unit,
        ),
      ];
    case 'weight':
      return [parameter(measurement.id, 'WEIGHT', measurement.value, measurement.unit)];
  }
}

/**
 * Construye una lectura desde el estado demo actual.
 *
 * Solo se utiliza en sesiones de demostración; nunca sustituye un error real.
 */
function localReading(patientId: string, readingId: string): ReadingResponse | null {
  const related = demo
    .snapshot()
    .measurements.filter(
      (measurement) =>
        measurement.patientId === patientId && measurement.readingId === readingId,
    );

  const first = related[0];
  if (!first) return null;

  return {
    readingId,
    patientId,
    recordedBy: first.recordedById ?? 'mock-user',
    context: first.context === 'PREPRANDIAL' || first.context === 'POSTPRANDIAL' ? first.context : null,
    measuredAt: first.measuredAt,
    source: 'MOCK',
    status: 'EVALUATED',
    confirmationReasons: [],
    evaluation: null,
    measurements: related.flatMap(toApiMeasurements),
  };
}

export const readingsService = {
  /** Historial real del paciente autorizado; un error no se sustituye por datos demo. */
  async list(patientId: string, page = 1, filters: HistoryFilters = {}, forceRefresh = false): Promise<ReadingPageResponse> {
    if (authSession.mode() !== 'backend' || !authSession.user()) {
      throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401,
        message: 'Inicia sesión con el backend para consultar el historial.' });
    }
    const state = appState.snapshot();
    if (state.selectedPatient?.id !== patientId || !state.permissions.read ||
        !state.user || state.user.source !== 'backend') {
      throw new ApiError({ code: 'FORBIDDEN', status: 403,
        message: 'No tienes permiso para consultar el historial de este paciente.' });
    }
    if (!Number.isInteger(page) || page < 1) {
      throw new ApiError({ code: 'INVALID_PAGE', status: 422, message: 'La página solicitada no es válida.' });
    }
    const generation = authSession.generation();
    const path = `/patients/${encodeURIComponent(patientId)}/readings`;
    const query = { page, size: HISTORY_PAGE_SIZE, ...filters };
    try {
      const result = await dataClient.get<ReadingPageResponse>(path, {
        query,
        retry: false,
        cache: { ttlMs: 10_000, staleIfErrorMs: 0, forceRefresh },
      });
      if (generation !== authSession.generation() || appState.snapshot().selectedPatient?.id !== patientId ||
          !appState.snapshot().permissions.read) {
        throw new ApiError({ code: 'SESSION_CHANGED', message: 'Cambió el paciente o la sesión. Recarga el historial.' });
      }
      return checkHistoryPage(result, patientId, page);
    } catch (cause) {
      const error = normalizeApiError(cause);
      if (error.code === 'INVALID_API_RESPONSE') dataClient.invalidate(path, query);
      throw error;
    }
  },
  /** Detalle de la lectura para la sesión/paciente activo; los errores no se reemplazan con mocks. */
  async detail(patientId: string, readingId: string, forceRefresh = false): Promise<ReadingResponse> {
    const mode = authSession.mode();
    if (!mode || !authSession.user()) {
      throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401,
        message: 'Inicia sesión para consultar el detalle.' });
    }
    const state = appState.snapshot();
    if (!patientId || !readingId || state.selectedPatient?.id !== patientId ||
        !state.permissions.read || !state.user || state.user.source !== mode) {
      throw new ApiError({ code: 'FORBIDDEN', status: 403,
        message: 'No tienes permiso para ver esta lectura del paciente.' });
    }
    if (mode === 'mock') {
      const local = localReading(patientId, readingId);
      if (local) return local;
      throw new ApiError({ code: 'RESOURCE_NOT_FOUND', status: 404,
        message: 'No se encontró la lectura de demostración solicitada.' });
    }
    if (mode !== 'backend' || !validReadingId(patientId) || !validReadingId(readingId)) {
      throw new ApiError({ code: 'INVALID_READING_ID', status: 422,
        message: 'El identificador de la lectura no es válido.' });
    }
    const generation = authSession.generation();
    const path = `/patients/${encodeURIComponent(patientId)}/readings/${encodeURIComponent(readingId)}`;
    try {
      const result = await dataClient.get<ReadingResponse>(path, {
        retry: false,
        cache: { ttlMs: DETAIL_CACHE_MS, staleIfErrorMs: 0, forceRefresh },
      });
      const latest = appState.snapshot();
      if (generation !== authSession.generation() || authSession.mode() !== 'backend' ||
          latest.user?.source !== 'backend' || latest.selectedPatient?.id !== patientId ||
          !latest.permissions.read) {
        throw new ApiError({ code: 'SESSION_CHANGED',
          message: 'Cambió la sesión o el paciente. Vuelve a abrir la lectura.' });
      }
      return checkReadingDetail(result, patientId, readingId);
    } catch (cause) {
      const error = normalizeApiError(cause);
      if (error.code === 'INVALID_API_RESPONSE') dataClient.invalidate(path);
      throw error;
    }
  },
};
