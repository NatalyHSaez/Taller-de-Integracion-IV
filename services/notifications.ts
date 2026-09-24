import { NOTIFICACIONES_INICIALES, type Notificacion } from '@/constants/notifications-mock';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Mientras no hay backend, esta variable en memoria hace de "servidor" mock.
// Vive mientras la app esté abierta; se reinicia si recargas Metro.
let notificacionesEnMemoria: Notificacion[] = [...NOTIFICACIONES_INICIALES];

export async function getNotifications(): Promise<Notificacion[]> {
  if (!API_URL) {
    console.warn('[notifications] EXPO_PUBLIC_API_URL no configurada, usando datos mock.');
    return notificacionesEnMemoria;
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/patients/me/notifications`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Notificacion[];
  } catch (err) {
    console.warn('[notifications] Backend no disponible todavía, usando datos mock.', err);
    return notificacionesEnMemoria;
  }
}

export async function getNotificationById(id: string): Promise<Notificacion | undefined> {
  const lista = await getNotifications();
  return lista.find((n) => n.id === id);
}

export async function markNotificationRead(id: string): Promise<void> {
  // Actualiza el mock local (para que la lista lo refleje al volver)
  notificacionesEnMemoria = notificacionesEnMemoria.map((n) =>
    n.id === id ? { ...n, leida: true } : n
  );

  if (!API_URL) return;

  try {
    await fetch(`${API_URL}/api/v1/notifications/${id}/read`, { method: 'PATCH' });
  } catch (err) {
    console.warn('[notifications] No se pudo marcar como leída en el servidor.', err);
  }
}