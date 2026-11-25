/**
 * Convenciones compartidas del contrato móvil ↔ API Gateway.
 * Estos tipos no transforman respuestas: describen los DTO esperados.
 */
export type UUID = string;
export type ISODateTime = string;
export type ISODate = string;

export type UserRole = 'PATIENT' | 'CAREGIVER' | 'DOCTOR' | 'ADMIN';
