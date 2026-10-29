import type { ISODateTime, NotificationStatus, UUID } from './common';
/** NotificationOut: GET /api/v1/notifications. */
export type NotificationResponse = {
  id: UUID;
  type: string;
  title: string;
  body: string;
  status: NotificationStatus;
  readAt: ISODateTime | null;
  createdAt: ISODateTime;
};
export type NotificationListResponse = {
  total: number;
  page: number;
  size: number;
  items: NotificationResponse[];
};
