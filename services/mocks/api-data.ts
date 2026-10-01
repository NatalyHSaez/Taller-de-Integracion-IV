import type {
  AlertResponse,
  AuthTokensResponse,
  CaregiverRelationshipResponse,
  ClinicalParameterResponse,
  DoctorProfileResponse,
  DoctorRelationshipResponse,
  EvaluationResponse,
  HealthConditionResponse,
  MedicalConsultationResponse,
  NotificationResponse,
  PatientConditionResponse,
  PatientProfileResponse,
  PatientSummaryResponse,
  ReadingResponse,
} from '../../types/api';

/**
 * Datos simulados que respetan el contrato provisional definido en types/api.
 * No representan todavía el contrato definitivo de Integración II.
 */

export type MockAccountRole = 'PATIENT' | 'CAREGIVER' | 'DOCTOR';

/**
 * Cuentas ficticias usadas para probar el inicio de sesión mientras no existe backend.
 * La contraseña vive aquí solo porque son datos de demostración locales.
 */
export type MockAccount = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: MockAccountRole;
  patientId?: string;
  doctorId?: string;
};

export const MOCK_ACCOUNTS = [
  {
    userId: '11111111-1111-4111-8111-111111111111',
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'paciente@ejemplo.com',
    password: 'Paciente123',
    role: 'PATIENT',
    patientId: '22222222-2222-4222-8222-222222222222',
  },
  {
    userId: '16161616-1616-4616-8616-161616161616',
    firstName: 'Roberto',
    lastName: 'Pérez',
    email: 'roberto@ejemplo.com',
    password: 'Roberto123',
    role: 'PATIENT',
    patientId: '33333333-3333-4333-8333-333333333333',
  },
  {
    userId: '13131313-1313-4313-8313-131313131313',
    firstName: 'Carla',
    lastName: 'Soto',
    email: 'cuidador@ejemplo.com',
    password: 'Cuidador123',
    role: 'CAREGIVER',
  },
  {
    userId: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
    firstName: 'Ana',
    lastName: 'González',
    email: 'medico@ejemplo.com',
    password: 'Medico123',
    role: 'DOCTOR',
    doctorId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  },
] satisfies MockAccount[];

export const MOCK_AUTH_TOKENS = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  token_type: 'bearer',
  expires_in: 900,
} satisfies AuthTokensResponse;

export const MOCK_PATIENTS = [
  {
    patientId: '22222222-2222-4222-8222-222222222222',
    firstName: 'Juan',
    lastName: 'Pérez',
    managementMode: 'AUTONOMOUS',
  },
  {
    patientId: '33333333-3333-4333-8333-333333333333',
    firstName: 'Roberto',
    lastName: 'Pérez',
    managementMode: 'ASSISTED',
  },
] satisfies PatientSummaryResponse[];

export const MOCK_PATIENT_PROFILES = [
  {
    patientId: '22222222-2222-4222-8222-222222222222',
    firstName: 'Juan',
    lastName: 'Pérez',
    birthDate: '1981-04-12',
    biologicalSex: 'MALE',
    managementMode: 'AUTONOMOUS',
  },
  {
    patientId: '33333333-3333-4333-8333-333333333333',
    firstName: 'Roberto',
    lastName: 'Pérez',
    birthDate: '1948-09-03',
    biologicalSex: 'MALE',
    managementMode: 'ASSISTED',
  },
] satisfies PatientProfileResponse[];

export const MOCK_HEALTH_CONDITIONS = [
  {
    conditionId: '44444444-4444-4444-8444-444444444441',
    code: 'HTA',
    name: 'Hipertensión arterial',
    active: true,
  },
  {
    conditionId: '44444444-4444-4444-8444-444444444442',
    code: 'DM2',
    name: 'Diabetes mellitus tipo 2',
    active: true,
  },
] satisfies HealthConditionResponse[];

export const MOCK_CLINICAL_PARAMETERS = [
  {
    parameterId: '55555555-5555-4555-8555-555555555551',
    code: 'SBP',
    name: 'Presión sistólica',
    valueType: 'NUMBER',
    canonicalUnit: 'mmHg',
    active: true,
  },
  {
    parameterId: '55555555-5555-4555-8555-555555555552',
    code: 'DBP',
    name: 'Presión diastólica',
    valueType: 'NUMBER',
    canonicalUnit: 'mmHg',
    active: true,
  },
  {
    parameterId: '55555555-5555-4555-8555-555555555553',
    code: 'HEART_RATE',
    name: 'Frecuencia cardíaca',
    valueType: 'NUMBER',
    canonicalUnit: 'bpm',
    active: true,
  },
  {
    parameterId: '55555555-5555-4555-8555-555555555554',
    code: 'GLUCOSE',
    name: 'Glucosa capilar',
    valueType: 'NUMBER',
    canonicalUnit: 'mg/dL',
    active: true,
  },
  {
    parameterId: '55555555-5555-4555-8555-555555555555',
    code: 'WEIGHT',
    name: 'Peso corporal',
    valueType: 'NUMBER',
    canonicalUnit: 'kg',
    active: true,
  },
] satisfies ClinicalParameterResponse[];

export const MOCK_PATIENT_CONDITIONS = [
  {
    patientConditionId: '66666666-6666-4666-8666-666666666661',
    patientId: '22222222-2222-4222-8222-222222222222',
    conditionId: '44444444-4444-4444-8444-444444444441',
    monitoringProfileId: '77777777-7777-4777-8777-777777777771',
    status: 'ACTIVE',
    startedAt: '2026-01-15',
    endedAt: null,
  },
  {
    patientConditionId: '66666666-6666-4666-8666-666666666662',
    patientId: '22222222-2222-4222-8222-222222222222',
    conditionId: '44444444-4444-4444-8444-444444444442',
    monitoringProfileId: '77777777-7777-4777-8777-777777777772',
    status: 'ACTIVE',
    startedAt: '2026-02-10',
    endedAt: null,
  },
] satisfies PatientConditionResponse[];

export const MOCK_READINGS = [
  {
    readingId: '88888888-8888-4888-8888-888888888881',
    patientId: '22222222-2222-4222-8222-222222222222',
    recordedByUserId: '11111111-1111-4111-8111-111111111111',
    context: 'REST',
    measuredAt: '2026-09-28T12:30:00Z',
    source: 'MANUAL',
    measurements: [
      {
        measurementId: '99999999-9999-4999-8999-999999999991',
        parameterCode: 'SBP',
        valueNumeric: 128,
        valueText: null,
        unit: 'mmHg',
        validationStatus: 'PLAUSIBLE',
        confirmedByUser: false,
      },
      {
        measurementId: '99999999-9999-4999-8999-999999999992',
        parameterCode: 'DBP',
        valueNumeric: 82,
        valueText: null,
        unit: 'mmHg',
        validationStatus: 'PLAUSIBLE',
        confirmedByUser: false,
      },
      {
        measurementId: '99999999-9999-4999-8999-999999999993',
        parameterCode: 'HEART_RATE',
        valueNumeric: 72,
        valueText: null,
        unit: 'bpm',
        validationStatus: 'PLAUSIBLE',
        confirmedByUser: false,
      },
    ],
  },
  {
    readingId: '88888888-8888-4888-8888-888888888882',
    patientId: '22222222-2222-4222-8222-222222222222',
    recordedByUserId: '11111111-1111-4111-8111-111111111111',
    context: 'PREPRANDIAL',
    measuredAt: '2026-09-28T10:00:00Z',
    source: 'MANUAL',
    measurements: [
      {
        measurementId: '99999999-9999-4999-8999-999999999994',
        parameterCode: 'GLUCOSE',
        valueNumeric: 120,
        valueText: null,
        unit: 'mg/dL',
        validationStatus: 'PLAUSIBLE',
        confirmedByUser: false,
      },
    ],
  },
] satisfies ReadingResponse[];

export const MOCK_EVALUATIONS = [
  {
    evaluationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    patientId: '22222222-2222-4222-8222-222222222222',
    readingId: '88888888-8888-4888-8888-888888888881',
    ruleProfileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    ruleProfileVersion: 1,
    status: 'NORMAL',
    resultCode: 'HTA_WITHIN_REFERENCE',
    explanation: 'Lectura evaluada con el perfil HTA_RULES v1.',
    evaluatedAt: '2026-09-28T12:30:05Z',
  },
  {
    evaluationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    patientId: '22222222-2222-4222-8222-222222222222',
    readingId: '88888888-8888-4888-8888-888888888882',
    ruleProfileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    ruleProfileVersion: 1,
    status: 'NORMAL',
    resultCode: 'DM2_WITHIN_REFERENCE',
    explanation: 'Lectura evaluada con el perfil DM2_RULES v1.',
    evaluatedAt: '2026-09-28T10:00:05Z',
  },
] satisfies EvaluationResponse[];

export const MOCK_ALERTS = [
  {
    alertId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    patientId: '22222222-2222-4222-8222-222222222222',
    readingId: '88888888-8888-4888-8888-888888888883',
    measurementId: '99999999-9999-4999-8999-999999999995',
    evaluationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    ruleProfileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    ruleProfileVersion: 1,
    ruleCode: 'HTA_WARNING',
    severity: 'ADVERTENCIA',
    explanation: 'Ejemplo simulado de una alerta generada por una regla clínica.',
    status: 'OPEN',
    createdAt: '2026-09-27T18:00:05Z',
    updatedAt: '2026-09-27T18:00:05Z',
    readAt: null,
    closedAt: null,
  },
] satisfies AlertResponse[];

export const MOCK_NOTIFICATIONS = [
  {
    id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    tipo: 'alerta_clinica',
    titulo: 'Nueva alerta clínica',
    cuerpo: 'Se generó una alerta para una lectura reciente.',
    estado: 'pending',
    leida_en: null,
    creada_en: '2026-09-27T18:00:10Z',
  },
] satisfies NotificationResponse[];

export const MOCK_DOCTORS = [
  {
    doctorId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    userId: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
    firstName: 'Ana',
    lastName: 'González',
    profession: 'Médico',
    registryStatus: 'VERIFIED',
    verifiedAt: '2026-09-20T15:00:00Z',
  },
] satisfies DoctorProfileResponse[];

export const MOCK_CAREGIVER_RELATIONSHIPS = [
  {
    relationshipId: '12121212-1212-4212-8212-121212121212',
    caregiverUserId: '13131313-1313-4313-8313-131313131313',
    patientId: '22222222-2222-4222-8222-222222222222',
    status: 'ACTIVE',
    permissions: [
      'PATIENT_PROFILE_VIEW',
      'MEASUREMENT_CREATE',
      'MEASUREMENT_VIEW',
      'ALERT_VIEW',
    ],
    createdAt: '2026-09-01T12:00:00Z',
    revokedAt: null,
  },
] satisfies CaregiverRelationshipResponse[];

export const MOCK_DOCTOR_RELATIONSHIPS = [
  {
    relationshipId: '14141414-1414-4414-8414-141414141414',
    doctorId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    doctorUserId: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
    patientId: '22222222-2222-4222-8222-222222222222',
    status: 'ACTIVE',
    permissions: [
      'PATIENT_PROFILE_VIEW',
      'MEASUREMENT_VIEW',
      'ALERT_VIEW',
      'CLINICAL_VISIT_VIEW',
      'CLINICAL_VISIT_CREATE',
      'PRESCRIPTION_CREATE',
      'PRESCRIPTION_VIEW',
      'DOCUMENT_CREATE',
      'DOCUMENT_VIEW',
    ],
    createdAt: '2026-09-15T12:00:00Z',
    revokedAt: null,
  },
] satisfies DoctorRelationshipResponse[];

export const MOCK_CONSULTATIONS = [
  {
    consultationId: '15151515-1515-4515-8515-151515151515',
    patientId: '22222222-2222-4222-8222-222222222222',
    doctorId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    occurredAt: '2026-09-22T14:30:00Z',
    reason: 'Control de seguimiento',
    clinicalImpression: null,
    observations: 'Registro simulado para desarrollo de interfaz.',
    indications: null,
    status: 'FINALIZED',
    createdAt: '2026-09-22T14:30:00Z',
    updatedAt: '2026-09-22T15:00:00Z',
    finalizedAt: '2026-09-22T15:00:00Z',
    prescriptions: [],
    documents: [],
    addenda: [],
  },
] satisfies MedicalConsultationResponse[];
