import type { ISODateTime, NotificationStatus, UUID } from './common';

export type NotificationResponse = {
  notificationId: UUID;
  notificationType: string;
  title: string;
  body: string;
  status: NotificationStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  readAt: ISODateTime | null;
};
