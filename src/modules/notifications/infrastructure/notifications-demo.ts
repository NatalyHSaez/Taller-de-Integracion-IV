import { mockApi } from '../../demo/infrastructure/mocks/api-mock';
import { type AppNotification, type NotificationsApi } from '../domain/notification';
import { toAppNotification } from './notifications-api';

/**
 * Sesión de demostración (sin servidor). Pagina y filtra igual que el backend;
 * las notificaciones marcadas quedan leídas mientras la app esté abierta.
 * Nunca se usa como respaldo de una sesión real.
 */
const readIds = new Map<string, string>();

export const demoNotificationsApi: NotificationsApi = {
  async list({ page, size, status }) {
    const all = (await mockApi.notifications.list())
      .map(toAppNotification)
      .filter((n): n is AppNotification => n !== null)
      .map((n) => (readIds.has(n.id) ? { ...n, status: 'read' as const, readAt: readIds.get(n.id) ?? null } : n))
      .filter((n) => !status || n.status === status)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { total: all.length, page, size, items: all.slice((page - 1) * size, page * size) };
  },
  async markRead(id) {
    readIds.set(id, new Date().toISOString());
  },
};
