import type { UUID } from './common';

/** Elemento de validación automática devuelto por FastAPI con HTTP 422. */
export type ValidationErrorDetail = {
  loc: (string | number)[];
  msg: string;
  type: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
};

/** Formato de error real del backend. */
export type ApiErrorResponse = {
  detail: string | ValidationErrorDetail[];
  errorCode?: string;
};

/** Representación normalizada que utiliza internamente la aplicación. */
export type ClientApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    correlationId: UUID;
  };
};
