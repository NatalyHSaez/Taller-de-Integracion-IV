export * from '@/src/core/domain/contracts/common';

export type UserStatus = 'ACTIVE' | 'DISABLED';
export type PatientManagementMode = 'AUTONOMOUS' | 'ASSISTED';
export type BiologicalSex = 'FEMALE' | 'MALE' | 'UNSPECIFIED';
export type DoctorRegistryStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

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
