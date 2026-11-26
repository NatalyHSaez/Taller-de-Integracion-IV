/**
 * Adaptador HTTP del microservicio de notificaciones, vía API Gateway:
 *   GET  /notifications?page=&size=&status=pending|sent|read
 *   POST /notifications/{notificationId}/read  → 204
 */
import { apiClient } from '../../../core/infrastructure/http/api-client';
import { normalizeApiError } from '../../../core/infrastructure/http/errors';
import type { AppNotification, NotificationStatus, NotificationsApi } from '../domain/notification';

const STATUSES: NotificationStatus[] = ['pending', 'sent', 'read'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

/** Normaliza un elemento (contrato camelCase del backend; tolera campos en español del mock). */
export function toAppNotification(raw: unknown): AppNotification | null {
  if (!isRecord(raw)) return null;
  const status = String(raw.status ?? raw.estado ?? '').toLowerCase() as NotificationStatus;
  const createdAt = raw.createdAt ?? raw.creada_en;
  if (typeof raw.id !== 'string' || !STATUSES.includes(status) || typeof createdAt !== 'string') return null;
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  return {
    id: raw.id,
    type: text(raw.type ?? raw.tipo),
    title: text(raw.title ?? raw.titulo),
    body: text(raw.body ?? raw.cuerpo),
    status,
    createdAt,
    readAt: typeof (raw.readAt ?? raw.leida_en) === 'string' ? ((raw.readAt ?? raw.leida_en) as string) : null,
  };
}

export const backendNotificationsApi: NotificationsApi = {
  async list({ page, size, status }) {
    const raw = await apiClient.get<unknown>('/notifications', { query: { page, size, status } });
    if (!isRecord(raw) || !Array.isArray(raw.items)) {
      throw normalizeApiError(new Error('Las notificaciones tienen un formato inesperado.'));
    }
    return {
      total: typeof raw.total === 'number' ? raw.total : raw.items.length,
      page: typeof raw.page === 'number' ? raw.page : page,
      size: typeof raw.size === 'number' ? raw.size : size,
      items: raw.items.map(toAppNotification).filter((n): n is AppNotification => n !== null),
    };
  },
  async markRead(notificationId) {
    // 204 sin cuerpo; también si ya estaba leída.
    await apiClient.post<void>(`/notifications/${encodeURIComponent(notificationId)}/read`);
  },
};
