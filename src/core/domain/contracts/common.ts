/**
 * Convenciones compartidas del contrato móvil ↔ API Gateway.
 * Estos tipos no transforman respuestas: describen los DTO esperados.
 */
export type UUID = string;
export type ISODateTime = string;
export type ISODate = string;

export type UserRole = 'PATIENT' | 'CAREGIVER' | 'DOCTOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'DISABLED';
export type PatientManagementMode = 'AUTONOMOUS' | 'ASSISTED';
export type BiologicalSex = 'FEMALE' | 'MALE' | 'UNSPECIFIED';
export type DoctorRegistryStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

/** Estado de una lectura; no debe confundirse con una medición individual. */
export type ReadingStatus = 'PENDING' | 'REQUIRES_CONFIRMATION' | 'EVALUATED';

/** Se conserva para módulos y contratos provisionales que aún lo utilizan. */
export type MeasurementValidationStatus =
  | 'PENDING'
  | 'PLAUSIBLE'
  | 'REQUIRES_CONFIRMATION'
  | 'CONFIRMED';

/** Compatibilidad con evaluaciones clínicas vigentes y provisionales de main. */
export type EvaluationStatus =
  | 'NORMAL'
  | 'INFORMATIVA'
  | 'ADVERTENCIA'
  | 'ALERTA'
  | 'DATOS_INSUFICIENTES'
  | 'NO_APLICABLE'
  | 'ENTRADA_INVALIDA';

export type NotificationStatus = 'pending' | 'sent' | 'read';
