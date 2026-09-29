/**
 * Tipos compartidos del contrato móvil <-> API Gateway.
 *
 * NOTA: mientras Integración II no publique OpenAPI/Swagger, estos tipos
 * representan el contrato provisional del frontend basado en la propuesta final.
 */

export type UUID = string;
export type ISODateTime = string;
export type ISODate = string;

export type UserRole = 'PATIENT' | 'CAREGIVER' | 'DOCTOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export type PatientManagementMode = 'AUTONOMOUS' | 'ASSISTED';
export type BiologicalSex = 'FEMALE' | 'MALE' | 'UNSPECIFIED';

export type DoctorRegistryStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type MeasurementValidationStatus =
  | 'PENDING'
  | 'PLAUSIBLE'
  | 'REQUIRES_CONFIRMATION'
  | 'CONFIRMED';

export type EvaluationStatus =
  | 'NORMAL'
  | 'INFORMATIVA'
  | 'ADVERTENCIA'
  | 'ALERTA'
  | 'DATOS_INSUFICIENTES'
  | 'NO_APLICABLE'
  | 'ENTRADA_INVALIDA';

export type NotificationStatus = 'UNREAD' | 'READ';
