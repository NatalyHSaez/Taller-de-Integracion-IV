import { API_V1_URL } from "@/config/api";
import type { Notificacion } from "@/constants/notifications-mock";
import type {
  NotificationListResponse,
  NotificationResponse,
} from "@/types/api";

import { dataClient } from "./data";
import { demo } from "./demo-store";
import { normalizeApiError } from "./errors";
import { mockApi } from "./mocks/api-mock";

const read = new Set<string>();

function describeMeasurement(
  measurement: ReturnType<typeof demo.measurements>[number],
): string {
  if (measurement.type === "blood_pressure") {
    return `Presión arterial: ${measurement.systolic}/${measurement.diastolic} mmHg, ${measurement.heartRate} lpm`;
  }

  if (measurement.type === "glucose") {
    return `Glucosa: ${measurement.value} mg/dL`;
  }

  return `Peso: ${measurement.value} kg`;
}

function toNotification(item: NotificationResponse): Notificacion {
  const date = new Date(item.creada_en);

  return {
    id: item.id,

    titulo: item.titulo,

    descripcion: item.cuerpo,

    hora: new Intl.DateTimeFormat("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date),

    leida: item.estado === "read" || read.has(item.id),
  };
}

function getRelationNotifications(): Notificacion[] {
  const user = demo.user();

  if (!user) {
    return [];
  }

  const snapshot = demo.snapshot();

  if (!snapshot.notificationPrefs.vinculos) {
    return [];
  }

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
              )?.name ?? "Un cuidador"
            } solicita acompañarte. Revisa su identidad y permisos en Vínculos.`
          : "Consulta el estado y tus pacientes en Vínculos.",

      hora: "",

      leida: read.has(`${relation.id}-${relation.status}`),
    }));
}

function getMeasurementNotifications(): Notificacion[] {
  const user = demo.user();

  if (!user) {
    return [];
  }

  if (!demo.snapshot().notificationPrefs.mediciones) {
    return [];
  }

  return demo
    .measurements()
    .slice()
    .sort(
      (a, b) =>
        new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
    )
    .map((measurement) => {
      const id = `measurement-${measurement.id}`;

      return {
        id,

        titulo: "Dato guardado",

        descripcion: `${describeMeasurement(measurement)}. Registrado por ${
          measurement.recordedBy ?? "ti"
        }.`,

        hora: new Date(measurement.measuredAt).toLocaleString("es-CL", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),

        leida: read.has(id),
      };
    });
}

/**
 * Notificaciones creadas únicamente en el
 * frontend durante el desarrollo.
 */
export function getDemoNotifications(): Notificacion[] {
  return [...getMeasurementNotifications(), ...getRelationNotifications()];
}

function uniqueNotifications(notifications: Notificacion[]): Notificacion[] {
  const unique = new Map<string, Notificacion>();

  notifications.forEach((notification) => {
    unique.set(notification.id, notification);
  });

  return [...unique.values()];
}

async function getMockNotifications(): Promise<Notificacion[]> {
  const mockNotifications = (await mockApi.notifications.list()).map(
    toNotification,
  );

  return uniqueNotifications([...mockNotifications, ...getDemoNotifications()]);
}

/**
 * Obtiene notificaciones reales cuando el
 * API Gateway está disponible.
 *
 * Se utilizan:
 * - caché;
 * - reintentos;
 * - caché de respaldo;
 * - fallback a mocks.
 */
export async function getNotifications(): Promise<Notificacion[]> {
  if (!API_V1_URL) {
    return getMockNotifications();
  }

  try {
    const response = await dataClient.get<NotificationListResponse>(
      "/notificaciones",
      {
        query: {
          page: 1,
          size: 100,
        },

        cache: {
          ttlMs: 30_000,

          staleIfErrorMs: 5 * 60_000,
        },

        retry: {
          attempts: 3,

          initialDelayMs: 400,

          maxDelayMs: 1_600,
        },
      },
    );

    const backendNotifications = response.items.map(toNotification);

    /*
     * Mantenemos las notificaciones locales
     * mientras algunos flujos sigan siendo
     * simulados.
     */
    return uniqueNotifications([
      ...backendNotifications,
      ...getDemoNotifications(),
    ]);
  } catch (error) {
    console.warn(
      "[notifications] API real no disponible; usando datos simulados.",
      normalizeApiError(error),
    );

    return getMockNotifications();
  }
}

export async function getNotificationById(
  id: string,
): Promise<Notificacion | undefined> {
  const notifications = await getNotifications();

  return notifications.find((notification) => notification.id === id);
}

/**
 * El backend revisado todavía no posee una
 * ruta estable para marcar notificaciones
 * como leídas.
 *
 * Por ahora mantenemos el cambio local.
 */
export async function markNotificationRead(id: string): Promise<void> {
  read.add(id);
}
