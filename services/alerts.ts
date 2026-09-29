import type { AlertaItem } from '@/constants/alerts-mock';
import type { AlertResponse } from '@/types/api';
import { demo } from './demo-store';
import { MOCK_ALERTS } from './mocks/api-data';

function toAlertItem(alert: AlertResponse): AlertaItem {
  const date = new Date(alert.createdAt);

  return {
    id: alert.alertId,
    severidad: alert.severity,
    parametro: alert.ruleCode.startsWith('HTA') ? 'Presión arterial' : 'Lectura clínica',
    mensaje: alert.explanation,
    comparacion: null,
    fecha: new Intl.DateTimeFormat('es-CL').format(date),
    hora: new Intl.DateTimeFormat('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date),
    regla: `${alert.ruleCode} v${alert.ruleProfileVersion}`,
  };
}

/** Alertas ficticias correspondientes al paciente seleccionado. */
export function getDemoAlerts(): AlertaItem[] {
  const patient = demo.patient();

  if (!patient) {
    return [];
  }

  return MOCK_ALERTS
    .filter((alert) => alert.patientId === patient.id)
    .map(toAlertItem);
}

export async function getAlerts(): Promise<AlertaItem[]> {
  return getDemoAlerts();
}
