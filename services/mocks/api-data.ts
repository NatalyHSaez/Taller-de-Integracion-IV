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
 * Datos simulados para el contrato público actual de Integra II.
 * Se usan solo en sesiones mock, nunca como datos clínicos reales.
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
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  tokenType: 'bearer',
  expiresIn: 900,
} satisfies AuthTokensResponse;

export const MOCK_PATIENTS = [
  { patientId: '22222222-2222-4222-8222-222222222222', fullName: 'Juan Pérez', relationshipId: '12121212-1212-4212-8212-121212121212', relationshipType: 'CAREGIVER', permissions: ['PATIENT_PROFILE_VIEW', 'MEASUREMENT_CREATE', 'MEASUREMENT_VIEW', 'ALERT_VIEW'], linkedAt: '2026-09-01T12:00:00Z' },
  { patientId: '33333333-3333-4333-8333-333333333333', fullName: 'Roberto Pérez', relationshipId: '19191919-1919-4919-8919-191919191919', relationshipType: 'CAREGIVER', permissions: ['MEASUREMENT_VIEW'], linkedAt: '2026-09-01T12:00:00Z' },
] satisfies PatientSummaryResponse[];

export const MOCK_PATIENT_PROFILES = [
  { id: '22222222-2222-4222-8222-222222222222', fullName: 'Juan Pérez', birthDate: '1981-04-12', age: 45, biologicalSex: 'MALE', managementMode: 'AUTONOMOUS' },
  { id: '33333333-3333-4333-8333-333333333333', fullName: 'Roberto Pérez', birthDate: '1948-09-03', age: 78, biologicalSex: 'MALE', managementMode: 'ASSISTED' },
] satisfies PatientProfileResponse[];

export const MOCK_HEALTH_CONDITIONS = [
  { code: 'HTA', name: 'Hipertensión arterial', parameters: [{code:'SBP',required:true},{code:'DBP',required:true},{code:'HEART_RATE',required:false}] },
  { code: 'DM2', name: 'Diabetes mellitus tipo 2', parameters: [{code:'GLUCOSE',required:true}] },
] satisfies HealthConditionResponse[];

export const MOCK_CLINICAL_PARAMETERS = [
  { code: 'SBP', name: 'Presión sistólica', valueType: 'NUMBER', unit: 'mmHg', technicalMin: 50, technicalMax: 300 },
  { code: 'DBP', name: 'Presión diastólica', valueType: 'NUMBER', unit: 'mmHg', technicalMin: 30, technicalMax: 200 },
  { code: 'HEART_RATE', name: 'Frecuencia cardíaca', valueType: 'NUMBER', unit: 'bpm', technicalMin: 20, technicalMax: 250 },
  { code: 'GLUCOSE', name: 'Glucosa capilar', valueType: 'NUMBER', unit: 'mg/dL', technicalMin: 20, technicalMax: 600 },
  { code: 'WEIGHT', name: 'Peso corporal', valueType: 'NUMBER', unit: 'kg', technicalMin: 1, technicalMax: 500 },
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
    readingId: '88888888-8888-4888-8888-888888888881', patientId: '22222222-2222-4222-8222-222222222222',
    recordedBy: '11111111-1111-4111-8111-111111111111', context: null,
    measuredAt: '2026-09-28T12:30:00Z', source: 'mobile', status: 'EVALUATED', confirmationReasons: [],
    measurements: [
      { measurementId:'99999999-9999-4999-8999-999999999991', parameterCode:'SBP', value:128, unit:'mmHg', confirmedByUser:false },
      { measurementId:'99999999-9999-4999-8999-999999999992', parameterCode:'DBP', value:82, unit:'mmHg', confirmedByUser:false },
      { measurementId:'99999999-9999-4999-8999-999999999993', parameterCode:'HEART_RATE', value:72, unit:'bpm', confirmedByUser:false },
    ],
    evaluation: {status:'NORMAL', severity:null, explanation:'Lectura de presión evaluada (ejemplo simulado).', evaluatedAt:'2026-09-28T12:30:05Z'},
  },
  {
    readingId: '88888888-8888-4888-8888-888888888882', patientId: '22222222-2222-4222-8222-222222222222',
    recordedBy: '11111111-1111-4111-8111-111111111111', context: 'PREPRANDIAL',
    measuredAt: '2026-09-28T10:00:00Z', source: 'mobile', status: 'EVALUATED', confirmationReasons: [],
    measurements: [ {measurementId:'99999999-9999-4999-8999-999999999994', parameterCode:'GLUCOSE', value:120, unit:'mg/dL', confirmedByUser:false } ],
    evaluation: {status:'NORMAL', severity:null, explanation:'Lectura de glucosa evaluada (ejemplo simulado).', evaluatedAt:'2026-09-28T10:00:05Z'},
  },
] satisfies ReadingResponse[];

// Endpoint /patients/{id}/evaluations sin implementar. Solo registros locales de demostración.
export const MOCK_EVALUATIONS = MOCK_READINGS.flatMap(reading =>
  reading.evaluation ? [{patientId: reading.patientId, readingId: reading.readingId, ...reading.evaluation}] : []
);

export const MOCK_ALERTS = [
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', readingId: '88888888-8888-4888-8888-888888888883',
    ruleCode: 'HTA_ALERT', severity: 'ALTA', explanation: 'Alerta de ejemplo: presión elevada.', status: 'OPEN',
    createdAt: '2026-09-27T18:00:05Z', readAt: null },
] satisfies AlertResponse[];

export const MOCK_NOTIFICATIONS = [
  { id:'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', type:'ALERT', title:'Nueva alerta clínica', body:'Se generó una alerta para una lectura reciente.', status:'pending', readAt:null, createdAt:'2026-09-27T18:00:10Z' },
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
  { relationshipId:'12121212-1212-4212-8212-121212121212', userId:'13131313-1313-4313-8313-131313131313',
    fullName:'Carla Soto', permissions:['PATIENT_PROFILE_VIEW','MEASUREMENT_CREATE','MEASUREMENT_VIEW','ALERT_VIEW'], linkedAt:'2026-09-01T12:00:00Z' },
] satisfies CaregiverRelationshipResponse[];

export const MOCK_DOCTOR_RELATIONSHIPS = [
  { relationshipId:'14141414-1414-4414-8414-141414141414', userId:'ffffffff-ffff-4fff-8fff-fffffffffff1',
    fullName:'Ana González', permissions:['PATIENT_PROFILE_VIEW','MEASUREMENT_VIEW','ALERT_VIEW'], linkedAt:'2026-09-15T12:00:00Z' },
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
