import type { ISODateTime, NotificationStatus, UUID } from './common';

/** Item real devuelto por GET /api/v1/notificaciones. */
export type NotificationResponse = {
  id: UUID;
  tipo: string;
  titulo: string;
  cuerpo: string;
  estado: NotificationStatus;
  leida_en: ISODateTime | null;
  creada_en: ISODateTime;
};

/** Respuesta paginada real de GET /api/v1/notificaciones. */
export type NotificationListResponse = {
  total: number;
  page: number;
  size: number;
  items: NotificationResponse[];
};
