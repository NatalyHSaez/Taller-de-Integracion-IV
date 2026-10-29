import type { Notificacion } from "@/constants/notifications-mock";
import type {
  NotificationListResponse,
  NotificationResponse,
} from "@/types/api";

import { authSession } from "./auth-session";
import { dataClient } from "./data";
import { demo } from "./demo-store";
import { ApiError, normalizeApiError } from "./errors";
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
  const date = new Date(item.createdAt);

  return {
    id: item.id,

    titulo: item.title,

    descripcion: item.body,

    hora: new Intl.DateTimeFormat("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date),

    leida: item.status === "read" || (authSession.mode() === "mock" && read.has(item.id)),
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
  if (authSession.mode() !== "mock") return [];
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

/** En sesión backend se propagan los errores; los mocks son un modo explícito. */
export async function getNotifications(forceRefresh = false): Promise<Notificacion[]> {
  if (authSession.mode() === "mock") {
    return getMockNotifications();
  }
  if (authSession.mode() !== "backend") {
    throw new ApiError({
      code: "AUTHENTICATION_REQUIRED",
      message: "Debes iniciar sesión para consultar tus notificaciones.",
      status: 401,
    });
  }

  try {
    const response = await dataClient.get<NotificationListResponse>("/notifications", {
      query: { page: 1, size: 100 },
      cache: {
        ttlMs: 30_000,
        // Esta pantalla aún no distingue visualmente una copia expirada.
        staleIfErrorMs: 0,
        forceRefresh,
      },
      retry: { attempts: 3, initialDelayMs: 400, maxDelayMs: 1_600 },
    });
    return response.items.map(toNotification);
  } catch (cause) {
    throw normalizeApiError(cause);
  }
}

export async function getNotificationById(
  id: string,
): Promise<Notificacion | undefined> {
  const notifications = await getNotifications(true);

  return notifications.find((notification) => notification.id === id);
}

/**
 * Solo el modo demo marca localmente. En backend se requiere el endpoint
 * POST /notifications/{id}/read, que se conectará en la tarea S5.
 */
export async function markNotificationRead(id: string): Promise<void> {
  if (authSession.mode() === 'mock') { read.add(id); return; }
  if (authSession.mode() !== 'backend') {
    throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401,
      message: 'Inicia sesión para revisar notificaciones.', details: {} });
  }
  // S5 implementará POST /notifications/{id}/read e invalidará la caché.
  throw new ApiError({ code: 'FLOW_NOT_AVAILABLE', status: 409,
    message: 'El marcado de notificaciones reales se integrará en el Sprint 2.', details: {} });
}
