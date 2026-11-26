/**
 * Adaptador HTTP del microservicio de notificaciones por API Gateway.
 * Las notificaciones pertenecen al usuario autenticado, no al paciente seleccionado.
 * Una respuesta inesperada se rechaza: nunca se sustituye por datos de demostración.
 */
import { apiClient } from '../../../../core/infrastructure/http/api-client';
import { ApiError } from '../../../../core/infrastructure/http/errors';
import type {
  AppNotification,
  NotificationStatus,
  NotificationsApi,
  NotificationsPage,
} from '../../domain/notification';

const STATUSES: readonly NotificationStatus[] = ['pending', 'sent', 'read'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value));
}

/** Valida NotificationOut en camelCase, sin alias ni normalizaciones históricas. */
export function toAppNotification(raw: unknown): AppNotification | null {
  if (!isRecord(raw)) return null;
  const { status, createdAt, readAt, type, title, body } = raw;
  if (
    typeof raw.id !== 'string' || !raw.id.trim() ||
    typeof status !== 'string' || !STATUSES.includes(status as NotificationStatus) || !isDate(createdAt) ||
    (readAt !== null && !isDate(readAt)) ||
    typeof type !== 'string' || !type.trim() ||
    typeof title !== 'string' || !title.trim() ||
    typeof body !== 'string'
  ) return null;
  return {
    id: raw.id, type, title, body,
    status: status as NotificationStatus, createdAt, readAt: readAt as string | null,
  };
}

function invalidPage(): ApiError {
  return new ApiError({
    code: 'INVALID_API_RESPONSE',
    status: 502,
    message: 'El servidor devolvió una lista de notificaciones inválida.',
    details: {},
  });
}

/**
 * Valida paginación, filtro, duplicados y campos de cada notificación.
 * Antes se descartaban silenciosamente elementos mal formados, ocultando errores
 * del backend y pudiendo mostrar contadores/páginas inconsistentes.
 */
export function checkNotificationPage(
  raw: unknown,
  page: number,
  size: number,
  status?: NotificationStatus,
): NotificationsPage {
  if (!isRecord(raw) ||
    !Number.isSafeInteger(raw.total) || (raw.total as number) < 0 ||
    raw.page !== page || raw.size !== size ||
    !Array.isArray(raw.items) || raw.items.length > size ||
    raw.items.length > (raw.total as number)) {
    throw invalidPage();
  }
  const found = new Set<string>();
  const items: AppNotification[] = [];
  for (const value of raw.items) {
    const item = toAppNotification(value);
    if (!item || found.has(item.id) || (status && item.status !== status)) {
      throw invalidPage();
    }
    found.add(item.id);
    items.push(item);
  }
  return { total: raw.total as number, page, size, items };
}

export const backendNotificationsApi: NotificationsApi = {
  async list({ page, size, status }) {
    const raw = await apiClient.get<unknown>('/notifications', {
      query: { page, size, status },
    });
    return checkNotificationPage(raw, page, size, status);
  },
  async markRead(notificationId) {
    // 204: el detalle y readAt se confirman al actualizar el listado.
    const result = await apiClient.post<unknown>(`/notifications/${encodeURIComponent(notificationId)}/read`);
    if (result !== undefined) {
      throw new ApiError({ code: 'INVALID_API_RESPONSE', status: 502,
        message: 'El servidor devolvió una respuesta inesperada al marcar la notificación.' });
    }
  },
};
