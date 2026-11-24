export type P7Step = {
  key: 'gateway' | 'identity' | 'patients' | 'profile' | 'readings';
  status: 'ok' | 'warning' | 'error';
  description: string;
};

export type P7Report = {
  ready: boolean;
  steps: P7Step[];
};

/**
 * Diagnóstico P7 de solo lectura.
 *
 * Las identidades y la comprobación de vigencia llegan desde la capa de
 * presentación, sin crear una dependencia de infraestructura a aplicación.
 * Los datos clínicos consultados no se conservan en este módulo ni se
 * incluyen en el informe (solo se informa la cantidad de lecturas).
 */
export type P7CheckContext = {
  userId: string | null;
  roles: readonly string[];
  selectedPatientId: string | null;
  isCurrent: () => boolean;
};

