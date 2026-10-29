/** Detalle de validación de FastAPI; puede traer campos adicionales en la red. */
export type ApiValidationError = {
  loc: (string | number)[];
  msg: string;
  type: string;
  [key: string]: unknown;
};

/** Contrato HTTP de Integra II. FastAPI puede omitir errorCode en un 422. */
export type ApiErrorResponse = {
  detail: string | ApiValidationError[];
  errorCode?: string;
};

/** Serialización interna y compatibilidad con los mocks; no es el DTO HTTP. */
export type LocalApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    correlationId: string;
  };
};
