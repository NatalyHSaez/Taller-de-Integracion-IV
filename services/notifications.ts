import { API_V1_URL } from '@/config/api';
import type { Notificacion } from '@/constants/notifications-mock';
import type { NotificationListResponse, NotificationResponse } from '@/types/api';
import { dataClient } from './data';
import { demo } from './demo-store';
import { normalizeApiError } from './errors';
import { mockApi } from './mocks/api-mock';

const read = new Set<string>();

function toNotification(item: NotificationResponse): Notificacion {
  const date = new Date(item.creada_en);

  return {
    id: item.id,
    titulo: item.titulo,
    descripcion: item.cuerpo,
    hora: new Intl.DateTimeFormat('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date),
    leida: item.estado === 'read' || read.has(item.id),
  };
}

/** Notificaciones generadas por vínculos creados en el demo-store. */
export function getDemoRelationNotifications(): Notificacion[] {
  const user = demo.user();

  if (!user) {
    return [];
  }

  const snapshot = demo.snapshot();

  return snapshot.relations
    .filter((relation) =>
      user.role === 'patient'
        ? relation.patientId === user.patientId && relation.status === 'pending'
        : relation.caregiverId === user.id,
    )
    .map((relation) => ({
      id: `${relation.id}-${relation.status}`,
      titulo:
        relation.status === 'pending'
          ? 'Solicitud de vínculo pendiente'
          : relation.status === 'approved'
            ? 'Vínculo aprobado'
            : relation.status === 'rejected'
              ? 'Solicitud rechazada'
              : 'Acceso retirado',
      descripcion:
        user.role === 'patient'
          ? `${snapshot.accounts.find((account) => account.id === relation.caregiverId)?.name ?? 'Un cuidador'} solicita acompañarte. Revisa su identidad y permisos en Vínculos.`
          : 'Consulta el estado y tus pacientes en Vínculos.',
      hora: '',
      leida: read.has(`${user.id}:${relation.id}-${relation.status}`),
    }));
}

async function getMockNotifications(): Promise<Notificacion[]> {
  const mockNotifications = (await mockApi.notifications.list()).map(toNotification);
  return [...mockNotifications, ...getDemoRelationNotifications()];
}

/**
 * Las notificaciones reales pasan por la capa de datos. Esta agrega caché temporal y
 * reintentos para errores transitorios antes de recurrir al fallback mock.
 *
 * Un 401/403 u otro error funcional no se reintenta automáticamente.
 */
export async function getNotifications(): Promise<Notificacion[]> {
  if (!API_V1_URL) {
    return getMockNotifications();
  }

  try {
    const response = await dataClient.get<NotificationListResponse>('/notificaciones', {
      query: { page: 1, size: 100 },
      cache: {
        ttlMs: 30_000,
        staleIfErrorMs: 5 * 60_000,
      },
      retry: {
        attempts: 3,
        initialDelayMs: 400,
        maxDelayMs: 1_600,
      },
    });

    const backendNotifications = response.items.map(toNotification);
    return [...backendNotifications, ...getDemoRelationNotifications()];
  } catch (error) {
    console.warn(
      '[notifications] API real no disponible para la sesión actual; usando mocks.',
      normalizeApiError(error),
    );

    return getMockNotifications();
  }
}

export async function getNotificationById(
  id: string,
): Promise<Notificacion | undefined> {
  const notifications = await getNotifications();
  return notifications.find((notification) => notification.id === id);
}

/**
 * El backend actual todavía no publica un endpoint para marcar notificaciones como leídas.
 * Por ahora el cambio permanece local para no llamar a una ruta inexistente.
 */
export async function markNotificationRead(id: string): Promise<void> {
  read.add(id);
}
