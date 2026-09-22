import notificacionesJson from '@/data/notifications-mock.json';

export type Notificacion = {
  id: string;
  titulo: string;
  descripcion: string;
  hora: string;
  leida: boolean;
};

export const NOTIFICACIONES_INICIALES: Notificacion[] = notificacionesJson;