import { API_V1_URL } from "@/config/api";
import {
  NOTIFICACIONES_INICIALES,
  type Notificacion,
} from "@/constants/notifications-mock";

export async function getNotifications(): Promise<Notificacion[]> {
  if (!API_V1_URL) {
    console.warn(
      "[notifications] API Gateway no configurado, usando datos mock.",
    );

    return NOTIFICACIONES_INICIALES;
  }

  try {
    const response = await fetch(`${API_V1_URL}/notifications`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as Notificacion[];
  } catch (error) {
    console.warn(
      "[notifications] Backend no disponible todavía, usando datos mock.",
      error,
    );

    return NOTIFICACIONES_INICIALES;
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!API_V1_URL) {
    return;
  }

  try {
    const response = await fetch(`${API_V1_URL}/notifications/${id}/read`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn(
      "[notifications] No se pudo marcar como leída en el servidor.",
      error,
    );
  }
}
