import { API_V1_URL } from "@/config/api";
import {
  NOTIFICACIONES_INICIALES,
  type Notificacion,
} from "@/constants/notifications-mock";
import { demo } from "./demo-store";

const read = new Set<string>();

/**
 * Obtiene las notificaciones generadas por el modo demo.
 */
export function getDemoNotifications(): Notificacion[] {
  const user = demo.user();

  if (!user) {
    return [];
  }

  const snapshot = demo.snapshot();

  return snapshot.relations
    .filter((relation) =>
      user.role === "patient"
        ? relation.patientId === user.patientId && relation.status === "pending"
        : relation.caregiverId === user.id,
    )
    .map((relation) => ({
      id: `${relation.id}-${relation.status}`,

      titulo:
        relation.status === "pending"
          ? "Solicitud de vínculo pendiente"
          : relation.status === "approved"
            ? "Vínculo aprobado"
            : relation.status === "rejected"
              ? "Solicitud rechazada"
              : "Acceso retirado",

      descripcion:
        user.role === "patient"
          ? `${
              snapshot.accounts.find(
                (account) => account.id === relation.caregiverId,
              )?.name
            } solicita acompañarte. Revisa su identidad y permisos en Vínculos.`
          : "Consulta el estado y tus pacientes en Vínculos.",

      hora: "",

      leida: read.has(`${user.id}:${relation.id}-${relation.status}`),
    }));
}

/**
 * Obtiene las notificaciones disponibles.
 *
 * Si el API Gateway está configurado, intenta obtenerlas desde el backend.
 * Si todavía no está disponible, utiliza los datos demo/mock.
 */
export async function getNotifications(): Promise<Notificacion[]> {
  if (!API_V1_URL) {
    console.warn(
      "[notifications] API Gateway no configurado, usando datos demo/mock.",
    );

    const demoNotifications = getDemoNotifications();

    return demo.user() ? demoNotifications : NOTIFICACIONES_INICIALES;
  }

  try {
    const response = await fetch(`${API_V1_URL}/notifications`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as Notificacion[];
  } catch (error) {
    console.warn(
      "[notifications] Backend no disponible todavía, usando datos demo/mock.",
      error,
    );

    const demoNotifications = getDemoNotifications();

    return demo.user() ? demoNotifications : NOTIFICACIONES_INICIALES;
  }
}

/**
 * Busca una notificación por su ID.
 */
export async function getNotificationById(
  id: string,
): Promise<Notificacion | undefined> {
  const notifications = await getNotifications();

  return notifications.find((notification) => notification.id === id);
}

/**
 * Marca una notificación como leída.
 *
 * En modo demo se almacena localmente.
 * Si existe backend, se intenta registrar también en el servidor.
 */
export async function markNotificationRead(id: string): Promise<void> {
  const user = demo.user();

  if (!API_V1_URL) {
    if (user) {
      read.add(`${user.id}:${id}`);
    }

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

    // Mantiene funcionando el modo demo si el backend falla.
    if (user) {
      read.add(`${user.id}:${id}`);
    }
  }
}
