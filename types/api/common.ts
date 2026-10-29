/** Convenciones del JSON público de Integra II (2026-10). */
export type UUID = string;
export type ISODateTime = string;
export type ISODate = string;
export type UserRole = 'PATIENT' | 'CAREGIVER' | 'DOCTOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'DISABLED';
export type PatientManagementMode = 'AUTONOMOUS' | 'ASSISTED';
export type BiologicalSex = 'FEMALE' | 'MALE' | 'UNSPECIFIED';
export type DoctorRegistryStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
/** Estados propios de la lectura, NO estados de cada medición. */
export type ReadingStatus = 'PENDING' | 'REQUIRES_CONFIRMATION' | 'EVALUATED';
/** Queda disponible para modelos locales antiguos, no lo devuelve MeasurementOut. */
export type MeasurementValidationStatus = 'PENDING' | 'PLAUSIBLE' | 'REQUIRES_CONFIRMATION' | 'CONFIRMED';
export type EvaluationStatus = 'NORMAL' | 'ADVERTENCIA' | 'ALERTA';
export type NotificationStatus = 'pending' | 'sent' | 'read';
