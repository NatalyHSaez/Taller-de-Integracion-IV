/** Notificación interna del usuario (entidad) y el contrato del repositorio que la provee. */

export type NotificationStatus = 'pending' | 'sent' | 'read';
export type NotificationFilter = 'all' | NotificationStatus;

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  status: NotificationStatus;
  createdAt: string;
  readAt: string | null;
};

export type NotificationsPage = { total: number; page: number; size: number; items: AppNotification[] };

export type NotificationsApi = {
  list(query: { page: number; size: number; status?: NotificationStatus }): Promise<NotificationsPage>;
  markRead(notificationId: string): Promise<void>;
};
