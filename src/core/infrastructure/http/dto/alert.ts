import type { ISODateTime, UUID } from './common';
/** AlertOut: GET /patients/{patientId}/alerts. No contiene patientId, version ni evaluationId. */
export type AlertResponse = {
  id: UUID;
  readingId: UUID;
  ruleCode: string;
  severity: string;
  explanation: string;
  status: 'OPEN' | 'READ';
  createdAt: ISODateTime;
  readAt: ISODateTime | null;
};
