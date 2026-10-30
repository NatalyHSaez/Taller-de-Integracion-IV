import type { Notificacion } from '@/constants/notifications-mock';
import type { NotificationListResponse, NotificationResponse, NotificationStatus } from '@/types/api';

import { apiClient } from './api';
import { authSession } from './auth-session';
import { dataClient } from './data';
import { demo } from './demo-store';
import { ApiError, normalizeApiError } from './errors';
import { mockApi } from './mocks/api-mock';

export type NotificationFilter = 'all' | NotificationStatus;
export type NotificationItem = Notificacion & {
  status: NotificationStatus;
  type: string;
  createdAt: string | null;
  readAt: string | null;
};
export type NotificationPage = {
  total: number;
  page: number;
  size: number;
  items: NotificationItem[];
};
export type NotificationListOptions = {
  page?: number;
  size?: number;
  status?: NotificationFilter;
  forceRefresh?: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const STATUSES: readonly NotificationStatus[] = ['pending', 'sent', 'read'];
const FILTERS: readonly NotificationFilter[] = ['all', ...STATUSES];

let visibleScope = '';
let demoRead = new Set<string>();
const knownDetails = new Map<string, NotificationItem>();

function sessionScope(): string {
  return `${authSession.generation()}:${authSession.mode() ?? 'guest'}:${authSession.user()?.id ?? '-'}`;
}

function syncScope(): string {
  const scope = sessionScope();
  if (scope !== visibleScope) {
    visibleScope = scope;
    demoRead = new Set<string>();
    knownDetails.clear();
  }
  return scope;
}

function error(code: string, message: string, status = 422): ApiError {
  return new ApiError({ code, message, status, details: {} });
}

function ensureSession(): 'mock' | 'backend' {
  syncScope();
  const mode = authSession.mode();
  if (!mode || !authSession.user()) {
    throw error('AUTHENTICATION_REQUIRED', 'Inicia sesión para ver tus notificaciones.', 401);
  }
  return mode;
}

function ensureSameScope(scope: string): void {
  if (scope !== sessionScope()) {
    syncScope();
    throw error('SESSION_CHANGED', 'La sesión cambió. Vuelve a consultar tus notificaciones.', 409);
  }
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_RE.test(value) && Number.isFinite(Date.parse(value));
}

function formattedDate(value: string | null): string {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function toView(item: NotificationResponse): NotificationItem {
  return {
    id: item.id,
    titulo: item.title,
    descripcion: item.body,
    hora: formattedDate(item.createdAt),
    leida: item.status === 'read',
    status: item.status,
    type: item.type,
    createdAt: item.createdAt,
    readAt: item.readAt,
  };
}

/** Valida el contrato de Integra II antes de publicar respuestas y guardarlas para el detalle. */
export function checkNotificationPage(
  value: unknown,
  page: number,
  size: number,
  status: NotificationFilter,
): NotificationListResponse {
  const invalid = () => error('INVALID_API_RESPONSE', 'El servidor devolvió una lista de notificaciones inválida.', 502);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const result = value as Record<string, unknown>;
  if (!Number.isSafeInteger(result.total) || (result.total as number) < 0 ||
    result.page !== page || result.size !== size || !Array.isArray(result.items) ||
    result.items.length > size || result.items.length > (result.total as number)) throw invalid();

  const ids = new Set<string>();
  for (const raw of result.items) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid();
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== 'string' || !UUID_RE.test(item.id) || ids.has(item.id) ||
      typeof item.type !== 'string' || !item.type.trim() ||
      typeof item.title !== 'string' || !item.title.trim() ||
      typeof item.body !== 'string' ||
      !STATUSES.includes(item.status as NotificationStatus) ||
      (status !== 'all' && item.status !== status) ||
      !validDate(item.createdAt) ||
      (item.readAt !== null && !validDate(item.readAt))) throw invalid();
    ids.add(item.id);
  }
  return value as NotificationListResponse;
}

function validateOptions(options: NotificationListOptions): Required<NotificationListOptions> {
  const { page = 1, size = 20, status = 'all', forceRefresh = false } = options;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(size) || size < 1 || size > 100 ||
    !FILTERS.includes(status)) {
    throw error('INVALID_NOTIFICATION_FILTER', 'La página, tamaño o filtro de notificaciones es inválido.');
  }
  return { page, size, status, forceRefresh };
}

function describeMeasurement(measurement: ReturnType<typeof demo.measurements>[number]): string {
  if (measurement.type === 'blood_pressure') {
    const heart = measurement.heartRate == null ? '' : `, ${measurement.heartRate} lpm`;
    return `Presión arterial: ${measurement.systolic}/${measurement.diastolic} mmHg${heart}`;
  }
  if (measurement.type === 'glucose') return `Glucosa: ${measurement.value} mg/dL`;
  return `Peso: ${measurement.value} kg`;
}

function demoNotification(item: Notificacion): NotificationItem {
  const read = demoRead.has(item.id) || item.leida;
  return { ...item, leida: read, status: read ? 'read' : 'pending',
    type: 'DEMO', createdAt: null, readAt: null };
}

function additionalDemoNotifications(): NotificationItem[] {
  const user = demo.user();
  if (!user) return [];
  const snapshot = demo.snapshot();
  const result: Notificacion[] = [];
  if (snapshot.notificationPrefs.mediciones) {
    for (const measurement of demo.measurements().slice().sort((a,b) =>
      new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())) {
      result.push({ id: `measurement-${measurement.id}`, titulo: 'Dato guardado',
        descripcion: `${describeMeasurement(measurement)}. Registrado por ${measurement.recordedBy ?? 'ti'}.`,
        hora: new Date(measurement.measuredAt).toLocaleString('es-CL', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), leida: false });
    }
  }
  if (snapshot.notificationPrefs.vinculos) {
    for (const relation of snapshot.relations.filter((entry) => user.role === 'patient'
      ? entry.patientId === user.patientId && entry.status === 'pending'
      : entry.caregiverId === user.id)) {
      result.push({ id: `${relation.id}-${relation.status}`,
        titulo: relation.status === 'pending' ? 'Solicitud de vínculo pendiente'
          : relation.status === 'approved' ? 'Vínculo aprobado'
          : relation.status === 'rejected' ? 'Solicitud rechazada' : 'Acceso retirado',
        descripcion: user.role === 'patient'
          ? `${snapshot.accounts.find((account) => account.id === relation.caregiverId)?.name ?? 'Un cuidador'} solicita acompañarte. Revisa sus permisos en Vínculos.`
          : 'Consulta el estado y tus pacientes en Vínculos.',
        hora: '', leida: false });
    }
  }
  return result.map(demoNotification);
}

/** Datos solo para demostración; nunca se devuelven al backend real. */
export function getDemoNotifications(): Notificacion[] {
  if (authSession.mode() !== 'mock') return [];
  syncScope();
  return additionalDemoNotifications();
}

async function mockNotifications(): Promise<NotificationItem[]> {
  const items = (await mockApi.notifications.list()).map((item) => ({
    ...toView(item), status: demoRead.has(item.id) ? 'read' as const : item.status,
    leida: demoRead.has(item.id) || item.status === 'read',
  }));
  const found = new Set<string>();
  return [...additionalDemoNotifications(), ...items].filter((item) => {
    if (found.has(item.id)) return false;
    found.add(item.id);
    return true;
  });
}

/** Listado autenticado y paginado. El backend identifica al receptor desde el JWT. */
export const notificationsService = {
  async list(options: NotificationListOptions = {}): Promise<NotificationPage> {
    const { page, size, status, forceRefresh } = validateOptions(options);
    const mode = ensureSession();
    const scope = sessionScope();
    if (mode === 'mock') {
      const all = (await mockNotifications()).filter((item) => status === 'all' || item.status === status);
      ensureSameScope(scope);
      const items = all.slice((page - 1) * size, page * size);
      for (const item of items) knownDetails.set(item.id, item);
      return { total: all.length, page, size, items };
    }

    const query = { page, size, ...(status === 'all' ? {} : { status }) };
    let raw: NotificationListResponse;
    try {
      raw = await dataClient.get<NotificationListResponse>('/notifications', {
        query, cache: { ttlMs: 20_000, forceRefresh, staleIfErrorMs: 0 },
        retry: { attempts: 2, initialDelayMs: 250, maxDelayMs: 800 },
      });
    } catch (cause) {
      throw normalizeApiError(cause);
    }
    ensureSameScope(scope);
    let checked: NotificationListResponse;
    try {
      checked = checkNotificationPage(raw, page, size, status);
    } catch (cause) {
      dataClient.invalidate('/notifications', query);
      throw cause;
    }
    for (const item of checked.items) knownDetails.set(item.id, toView(item));
    return { ...checked, items: checked.items.map(toView) };
  },

  /** No existe GET /notifications/{id}. Usamos solo el listado y su caché por usuario. */
  async detail(id: string): Promise<NotificationItem | undefined> {
    const mode = ensureSession();
    const scope = sessionScope();
    if (mode === 'backend' && !UUID_RE.test(id)) throw error('INVALID_NOTIFICATION_ID', 'ID de notificación inválido.');
    const remembered = knownDetails.get(id);
    if (remembered) return remembered;
    const firstPage = await this.list({ page: 1, size: 20, forceRefresh: true });
    ensureSameScope(scope);
    return firstPage.items.find((item) => item.id === id);
  },

  async markRead(id: string): Promise<void> {
    const mode = ensureSession();
    const scope = sessionScope();
    if (mode === 'mock') {
      const items = await mockNotifications();
      ensureSameScope(scope);
      if (!items.some((item) => item.id === id)) throw error('NOTIFICATION_NOT_FOUND', 'Notificación no encontrada.', 404);
      demoRead.add(id);
      const existing = knownDetails.get(id);
      if (existing) knownDetails.set(id, { ...existing, status: 'read', leida: true });
      return;
    }
    if (!UUID_RE.test(id)) throw error('INVALID_NOTIFICATION_ID', 'ID de notificación inválido.');
    try {
      await apiClient.post<void>(`/notifications/${id}/read`);
    } catch (cause) {
      ensureSameScope(scope);
      throw normalizeApiError(cause);
    }
    ensureSameScope(scope);
    // 204 = persistido en el servidor. No se inventa readAt; se consultará la lista.
    const existing = knownDetails.get(id);
    if (existing) knownDetails.set(id, { ...existing, status: 'read', leida: true, readAt: null });
    dataClient.invalidatePath('/notifications');
  },
};

/** Compatibilidad con pantallas y pruebas anteriores, sin reemplazar el servicio paginado. */
export async function getNotifications(forceRefresh = false): Promise<Notificacion[]> {
  return (await notificationsService.list({ page: 1, size: 100, forceRefresh })).items;
}

export async function getNotificationById(id: string): Promise<NotificationItem | undefined> {
  return notificationsService.detail(id);
}

export async function markNotificationRead(id: string): Promise<void> {
  return notificationsService.markRead(id);
}
