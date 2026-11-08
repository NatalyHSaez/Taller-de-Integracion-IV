/** Alerta clínica del paciente (entidad) y el contrato del repositorio que la provee. */

export type AlertStatus = 'OPEN' | 'READ';
export type AlertFilter = 'ALL' | AlertStatus;

export type PatientAlert = {
  id: string;
  readingId: string | null;
  ruleCode: string;
  severity: string;
  explanation: string;
  status: AlertStatus;
  createdAt: string;
  readAt: string | null;
};

export type AlertsService = {
  list(patientId: string, status?: AlertStatus): Promise<PatientAlert[]>;
  markRead(patientId: string, alertId: string): Promise<void>;
};
