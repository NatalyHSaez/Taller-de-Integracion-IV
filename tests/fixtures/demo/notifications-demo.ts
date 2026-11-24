import { demo } from './demo-store';
import { mockApi } from './mocks/api-mock';
import type { AppNotification, NotificationsApi } from '../../../src/modules/notifications/domain/notification';
import { toAppNotification } from '../../../src/modules/notifications/infrastructure/notifications-api';

/**
 * Notificaciones exclusivas del modo demostración. Incluye los ejemplos del
 * catálogo y los avisos por mediciones/vínculos de la implementación de Cristian.
 * No representa una notificación enviada por el backend ni una notificación push.
 */
let currentGeneration = -1;
let activeDemo = false;
const readIds = new Map<string, string>();
const generatedTimes = new Map<string, string>();

/** La capa de presentación informa la sesión: infraestructura no importa aplicación. */
export function setDemoNotificationSession(generation: number, enabled: boolean): void {
  if (generation !== currentGeneration || enabled !== activeDemo) {
    currentGeneration = generation;
    activeDemo = enabled;
    readIds.clear();
    generatedTimes.clear();
  }
}

function syncSession(): boolean {
  return activeDemo && Boolean(demo.user());
}

function occurrenceDate(id: string, preferred?: string): string {
  const stored = generatedTimes.get(id);
  if (stored) return stored;
  const date = preferred && Number.isFinite(Date.parse(preferred))
    ? new Date(preferred).toISOString() : new Date().toISOString();
  generatedTimes.set(id, date);
  return date;
}

function describeMeasurement(measurement: ReturnType<typeof demo.measurements>[number]): string {
  if (measurement.type === 'blood_pressure') {
    return `Presión arterial: ${measurement.systolic}/${measurement.diastolic} mmHg` +
      (measurement.heartRate == null ? '' : `, ${measurement.heartRate} lpm`);
  }
  if (measurement.type === 'glucose') return `Glucosa: ${measurement.value} ${measurement.unit}`;
  return `Peso: ${measurement.value} ${measurement.unit}`;
}

function generatedNotifications(): AppNotification[] {
  const user = demo.user();
  if (!user) return [];
  const state = demo.snapshot();
  const items: AppNotification[] = [];
  if (state.notificationPrefs.mediciones) {
    for (const measurement of demo.measurements()) {
      const id = `demo-measurement-${measurement.id}`;
      items.push({
        id, type: 'DEMO_MEASUREMENT', title: 'Dato guardado',
        body: `${describeMeasurement(measurement)}. Registrado por ${measurement.recordedBy ?? 'ti'}.`,
        status: 'pending', createdAt: occurrenceDate(id, measurement.measuredAt), readAt: null,
      });
    }
  }
  if (state.notificationPrefs.vinculos) {
    for (const relation of state.relations) {
      const related = user.role === 'patient'
        ? relation.patientId === (user.patientId ?? user.id)
        : relation.caregiverId === user.id;
      if (!related) continue;
      const id = `demo-link-${relation.id}-${relation.status}`;
      const caregiverName = state.accounts.find((account) => account.id === relation.caregiverId)?.name ?? 'Un cuidador';
      const title = relation.status === 'pending' ? 'Solicitud de vínculo pendiente'
        : relation.status === 'approved' ? 'Vínculo aprobado'
        : relation.status === 'rejected' ? 'Solicitud rechazada' : 'Acceso retirado';
      items.push({
        id, type: 'RELATIONSHIP', title,
        body: user.role === 'patient'
          ? `${caregiverName} tiene una actualización de vínculo. Revisa sus permisos en Vínculos.`
          : 'Consulta el estado de tu vínculo en Vínculos.',
        status: 'pending', createdAt: occurrenceDate(id), readAt: null,
      });
    }
  }
  return items;
}

function withReadState(item: AppNotification): AppNotification {
  const timestamp = readIds.get(item.id);
  return timestamp ? { ...item, status: 'read', readAt: timestamp } : item;
}

export const demoNotificationsApi: NotificationsApi = {
  async list({ page, size, status }) {
    if (!syncSession()) return { total: 0, page, size, items: [] };
    // snapshot de la identidad: descartar resultados de otra sesión tras el retardo del mock.
    const generation = currentGeneration;
    const base = await mockApi.notifications.list();
    if (!syncSession() || currentGeneration !== generation) return { total: 0, page, size, items: [] };
    const seen = new Set<string>();
    const all = [...generatedNotifications(), ...base.map(toAppNotification).filter((n): n is AppNotification => n !== null)]
      .map(withReadState)
      .filter((n) => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return !status || n.status === status;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { total: all.length, page, size, items: all.slice((page - 1) * size, page * size) };
  },
  async markRead(id) {
    if (!syncSession()) return;
    readIds.set(id, new Date().toISOString());
  },
};
