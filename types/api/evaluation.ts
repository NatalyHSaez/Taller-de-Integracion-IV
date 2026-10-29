import type { EvaluationStatus, ISODateTime } from './common';
/** EvaluationOut anidado en ReadingOut; no existe GET público /evaluations. */
export type EvaluationResponse = {
  status: EvaluationStatus;
  severity: string | null;
  explanation: string | null;
  evaluatedAt: ISODateTime | null;
};
