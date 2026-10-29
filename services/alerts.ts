import type { AlertaItem } from '@/constants/alerts-mock';
import type { AlertResponse } from '@/types/api';
import { authSession } from './auth-session';
import { demo } from './demo-store';
import { ApiError } from './errors';
import { MOCK_ALERTS } from './mocks/api-data';

function toAlertItem(alert: AlertResponse): AlertaItem {
  const date = new Date(alert.createdAt);

  return {
    id: alert.id,
    // La severidad clínica interna (p. ej. ALTA) no es un estado de la UI.
    severidad: 'ALERTA',
    parametro: alert.ruleCode.startsWith('HTA') ? 'Presión arterial' : 'Lectura clínica',
    mensaje: alert.explanation,
    comparacion: null,
    fecha: new Intl.DateTimeFormat('es-CL').format(date),
    hora: new Intl.DateTimeFormat('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date),
    regla: alert.ruleCode,
  };
}

/** Alertas ficticias correspondientes al paciente seleccionado. */
export function getDemoAlerts(): AlertaItem[] {
  if (authSession.mode() !== 'mock') return [];
  const patient = demo.patient();

  if (!patient) {
    return [];
  }

  return MOCK_ALERTS
    .filter(() => patient.id === '22222222-2222-4222-8222-222222222222')
    .map(toAlertItem);
}

export async function getAlerts(): Promise<AlertaItem[]> {
  if (authSession.mode() === 'mock') return getDemoAlerts();
  if (authSession.mode() !== 'backend') {
    throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401,
      message: 'Debes iniciar sesión para consultar alertas.', details: {} });
  }
  // La integración del endpoint de alertas pertenece a S4, no a P6.
  throw new ApiError({ code: 'FLOW_NOT_AVAILABLE', status: 409,
    message: 'La consulta de alertas reales se integrará en el Sprint 2.', details: {} });
}
