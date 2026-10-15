import type {
  AlertResponse,
  AuthTokensResponse,
  ClinicalParameterResponse,
  CurrentUserResponse,
  DoctorProfileResponse,
  DoctorVerificationResponse,
  EvaluationResponse,
  HealthConditionResponse,
  MedicalConsultationResponse,
  NotificationResponse,
  PatientConditionResponse,
  PatientProfileResponse,
  PatientSummaryResponse,
  ReadingResponse,
} from '../../types/api';
import {
  MOCK_ALERTS,
  MOCK_AUTH_TOKENS,
  MOCK_CLINICAL_PARAMETERS,
  MOCK_CONSULTATIONS,
  MOCK_DOCTORS,
  MOCK_EVALUATIONS,
  MOCK_HEALTH_CONDITIONS,
  MOCK_NOTIFICATIONS,
  MOCK_PATIENT_CONDITIONS,
  MOCK_PATIENT_PROFILES,
  MOCK_PATIENTS,
  MOCK_READINGS,
} from './api-data';
import { ApiError } from '../errors';
import { mockLogin, mockLogout, mockMe } from './auth-mock';

/** Retardo pequeño para que el mock se comporte parecido a una llamada HTTP real. */
const MOCK_DELAY_MS = 150;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Devuelve una copia del dato para impedir que una pantalla modifique
 * accidentalmente los datos base del mock.
 */
async function mockResponse<T>(value: T): Promise<T> {
  await sleep(MOCK_DELAY_MS);
  return JSON.parse(JSON.stringify(value)) as T;
}

function findOrThrow<T>(
  items: readonly T[],
  predicate: (item: T) => boolean,
  resource: string,
): T {
  const item = items.find(predicate);

  if (!item) {
    throw new ApiError({
      code: 'RESOURCE_NOT_FOUND',
      message: `${resource} no encontrado.`,
      details: { resource },
      status: 404,
    });
  }

  return item;
}

/**
 * Capa de API simulada.
 *
 * Las funciones son asíncronas para que las pantallas puedan trabajar de una
 * forma parecida a como lo harán luego con el API Gateway real. No se realizan
 * solicitudes de red.
 */
export const mockApi = {
  auth: {
    login: async (email: string, password: string): Promise<AuthTokensResponse> => {
      await sleep(MOCK_DELAY_MS);
      return mockLogin(email, password);
    },

    refresh: async (_refreshToken: string): Promise<AuthTokensResponse> =>
      mockResponse(MOCK_AUTH_TOKENS),

    me: async (): Promise<CurrentUserResponse> => {
      await sleep(MOCK_DELAY_MS);
      return mockMe();
    },

    logout: async (): Promise<void> => {
      await sleep(MOCK_DELAY_MS);
      mockLogout();
    },
  },

  catalog: {
    healthConditions: async (): Promise<HealthConditionResponse[]> =>
      mockResponse(MOCK_HEALTH_CONDITIONS),

    clinicalParameters: async (): Promise<ClinicalParameterResponse[]> =>
      mockResponse(MOCK_CLINICAL_PARAMETERS),
  },

  patients: {
    list: async (): Promise<PatientSummaryResponse[]> => mockResponse(MOCK_PATIENTS),

    profile: async (patientId: string): Promise<PatientProfileResponse> => {
      const patient = findOrThrow(
        MOCK_PATIENT_PROFILES,
        (item) => item.patientId === patientId,
        'Paciente',
      );
      return mockResponse(patient);
    },

    conditions: async (patientId: string): Promise<PatientConditionResponse[]> =>
      mockResponse(MOCK_PATIENT_CONDITIONS.filter((item) => item.patientId === patientId)),
  },

  readings: {
    list: async (patientId: string): Promise<ReadingResponse[]> =>
      mockResponse(MOCK_READINGS.filter((item) => item.patientId === patientId)),

    detail: async (patientId: string, readingId: string): Promise<ReadingResponse> => {
      const reading = findOrThrow(
        MOCK_READINGS,
        (item) => item.patientId === patientId && item.readingId === readingId,
        'Lectura',
      );
      return mockResponse(reading);
    },
  },

  evaluations: {
    list: async (patientId: string): Promise<EvaluationResponse[]> =>
      mockResponse(MOCK_EVALUATIONS.filter((item) => item.patientId === patientId)),
  },

  alerts: {
    list: async (patientId: string): Promise<AlertResponse[]> =>
      mockResponse(MOCK_ALERTS.filter((item) => item.patientId === patientId)),
  },

  notifications: {
    list: async (): Promise<NotificationResponse[]> => mockResponse(MOCK_NOTIFICATIONS),
  },

  doctors: {
    profile: async (doctorId: string): Promise<DoctorProfileResponse> => {
      const doctor = findOrThrow(
        MOCK_DOCTORS,
        (item) => item.doctorId === doctorId,
        'Médico',
      );
      return mockResponse(doctor);
    },

    verification: async (doctorId: string): Promise<DoctorVerificationResponse> => {
      const doctor = findOrThrow(
        MOCK_DOCTORS,
        (item) => item.doctorId === doctorId,
        'Médico',
      );

      return mockResponse({
        doctorId: doctor.doctorId,
        registryStatus: doctor.registryStatus,
        verifiedAt: doctor.verifiedAt,
      });
    },
  },

  clinical: {
    consultations: async (patientId: string): Promise<MedicalConsultationResponse[]> =>
      mockResponse(MOCK_CONSULTATIONS.filter((item) => item.patientId === patientId)),
  },
};
