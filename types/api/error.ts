import type { UUID } from './common';

/** Formato común de error definido en la propuesta. */
export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    correlationId: UUID;
  };
};
