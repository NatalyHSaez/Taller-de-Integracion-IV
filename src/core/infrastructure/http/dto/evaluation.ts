import type { EvaluationStatus, ISODateTime, UUID } from './common';

export type EvaluationResponse = {
  evaluationId: UUID;
  patientId: UUID;
  readingId: UUID;
  ruleProfileId: UUID;
  ruleProfileVersion: number;
  status: EvaluationStatus;
  resultCode: string;
  explanation: string;
  evaluatedAt: ISODateTime;
};
