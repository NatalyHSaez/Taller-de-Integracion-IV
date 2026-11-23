import type { AlertaItem } from '@/src/modules/demo/infrastructure/data/alerts-mock';
import type { Severidad } from '@/src/modules/evaluation/domain/severity';
import { demo } from '../../demo/infrastructure/demo-store';
import { MOCK_ALERTS } from '../../demo/infrastructure/mocks/api-data';

function asSeverity(severity: string): Severidad {
  switch (severity.toUpperCase()) {
    case 'NORMAL': return 'NORMAL';
    case 'INFORMATIVA': return 'INFORMATIVA';
    case 'ADVERTENCIA': case 'MEDIA': return 'ADVERTENCIA';
    case 'ALERTA': case 'ALTA': case 'CRITICA': case 'CRÍTICA': return 'ALERTA';
    default: return 'INFORMATIVA';
  }
}

function toAlertItem(alert: (typeof MOCK_ALERTS)[number]): AlertaItem {
  const date = new Date(alert.createdAt);

  return {
    id: alert.alertId,
    severidad: asSeverity(alert.severity),
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

/**
 * La selección de datos ficticios requiere una sesión mock explícita.
 * El modo se recibe de la presentación para no importar la capa de sesión
 * desde infraestructura (mantiene la arquitectura limpia de main).
 */
export function getDemoAlerts(sessionMode: 'backend' | 'mock' | null = null): AlertaItem[] {
  if (sessionMode !== 'mock') return [];
  const patient = demo.patient();

  if (!patient) {
    return [];
  }

  return MOCK_ALERTS
    .filter((alert) => alert.patientId === patient.id && alert.status === 'OPEN')
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map(toAlertItem);
}

/** Compatibilidad con clientes anteriores: nunca inventar datos ante un fallo real. */
export async function getAlerts(sessionMode: 'backend' | 'mock' | null = null): Promise<AlertaItem[]> {
  return getDemoAlerts(sessionMode);
}
