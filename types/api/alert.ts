import type { EvaluationStatus, ISODateTime, UUID } from './common';

/**
 * Alerta generada por Evaluación Clínica.
 * status permanece como string porque la propuesta no enumera sus estados internos.
 */
export type AlertResponse = {
  alertId: UUID;
  patientId: UUID;
  readingId: UUID;
  measurementId: UUID | null;
  evaluationId: UUID;
  ruleProfileId: UUID;
  ruleProfileVersion: number;
  ruleCode: string;
  severity: EvaluationStatus;
  explanation: string;
  status: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  readAt: ISODateTime | null;
  closedAt: ISODateTime | null;
};
