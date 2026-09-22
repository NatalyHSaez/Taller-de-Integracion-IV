import { NOTIFICACIONES_INICIALES, type Notificacion } from '@/constants/notifications-mock';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Reemplazar 'me' por el id real del paciente autenticado cuando exista
// el contexto de sesión (viene de Identity, /api/v1/me).
export async function getNotifications(): Promise<Notificacion[]> {
  if (!API_URL) {
    console.warn('[notifications] EXPO_PUBLIC_API_URL no configurada, usando datos mock.');
    return NOTIFICACIONES_INICIALES;
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/patients/me/notifications`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Notificacion[];
  } catch (err) {
    console.warn('[notifications] Backend no disponible todavía, usando datos mock.', err);
    return NOTIFICACIONES_INICIALES;
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!API_URL) return; // en modo mock no hay nada que persistir

  try {
    await fetch(`${API_URL}/api/v1/notifications/${id}/read`, { method: 'PATCH' });
  } catch (err) {
    console.warn('[notifications] No se pudo marcar como leída en el servidor.', err);
  }
}