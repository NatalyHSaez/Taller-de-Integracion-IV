/**
 * Tipos compartidos del contrato móvil <-> API Gateway.
 *
 * Los tipos marcados como contrato backend reflejan el código actual de
 * Integración II. Los tipos clínicos restantes siguen siendo provisionales
 * mientras sus endpoints todavía no estén implementados de extremo a extremo.
 */

export type UUID = string;
export type ISODateTime = string;
export type ISODate = string;

/** Roles que devuelve el contrato vigente del API Gateway. */
export type UserRole = 'PATIENT' | 'CAREGIVER' | 'DOCTOR' | 'ADMIN';

/** Se conserva para DTO provisionales que todavía lo requieran. */
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

/** Estados usados actualmente por notificaciones-service. */
export type NotificationStatus = 'pending' | 'sent' | 'read';
