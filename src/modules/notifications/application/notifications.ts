import { normalizeApiError } from '../../../core/infrastructure/http/errors';
import type { AppNotification, NotificationFilter, NotificationsApi } from '../domain/notification';

/**
 * Notificaciones internas del usuario autenticado.
 * - GET  /api/v1/notifications?page=&size=&status=pending|sent|read
 * - POST /api/v1/notifications/{notificationId}/read  → 204
 *
 * Son notificaciones INTERNAS: se consultan desde la app. No existe envío push
 * (Expo Notifications, FCM ni APNs); ver docs/notificaciones.md.
 *
 * El backend no tiene GET individual: el detalle usa la caché de lo ya listado.
 * Sin respaldo a datos simulados: si el servidor falla, se muestra el error.
 * Las notificaciones son del usuario (no del paciente): al cambiar de usuario
 * se descarta todo.
 */

export const NOTIFICATIONS_PAGE_SIZE = 20;

export type NotificationErrorKind = 'session' | 'forbidden' | 'not_found' | 'network';

export function classifyNotificationError(cause: unknown): { kind: NotificationErrorKind; message: string } {
  const error = normalizeApiError(cause, 'No se pudieron cargar las notificaciones.');
  if (error.status === 401) {
    return { kind: 'session', message: 'Tu sesión expiró. Inicia sesión nuevamente para ver tus notificaciones.' };
  }
  if (error.status === 403) {
    return { kind: 'forbidden', message: 'No tienes permiso para ver estas notificaciones.' };
  }
  if (error.status === 404 || error.code === 'NOTIFICATION_NOT_FOUND') {
    return { kind: 'not_found', message: 'Esta notificación ya no existe o no es tuya.' };
  }
  return { kind: 'network', message: 'No se pudo conectar con el servicio. Revisa tu conexión e inténtalo nuevamente.' };
}

export type NotificationsState = {
  ownerId: string | null;
  filter: NotificationFilter;
  items: AppNotification[];
  total: number;
  hasMore: boolean;
  loaded: boolean;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: { kind: NotificationErrorKind; message: string } | null;
  loadMoreError: string | null;
  marking: string[];
  markError: { id: string; kind: NotificationErrorKind; message: string } | null;
};

/** Une páginas sin repetir y mantiene el orden más reciente primero. */
export function mergeNotifications(current: AppNotification[], incoming: AppNotification[]): AppNotification[] {
  const seen = new Set(current.map((n) => n.id));
  const merged = [...current];
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function createNotificationsStore(options: { pageSize?: number; now?: () => Date } = {}) {
  const size = options.pageSize ?? NOTIFICATIONS_PAGE_SIZE;
  const now = options.now ?? (() => new Date());
  const initial: NotificationsState = {
    ownerId: null,
    filter: 'all',
    items: [],
    total: 0,
    hasMore: false,
    loaded: false,
    loading: false,
    refreshing: false,
    loadingMore: false,
    error: null,
    loadMoreError: null,
    marking: [],
    markError: null,
  };
  let state = initial;
  let api: NotificationsApi | null = null;
  let generation = 0;
  /**
   * Posición alcanzada en el orden del backend para el filtro actual. Si una
   * notificación sale del filtro (por ejemplo, se marca leída estando en
   * "pendientes"), la posición retrocede uno para no saltarse ninguna.
   */
  let position = 0;
  /** Caché por id de todo lo listado (para el detalle). */
  const cache = new Map<string, AppNotification>();
  const inFlight = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();

  const set = (patch: Partial<NotificationsState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const statusParam = () => (state.filter === 'all' ? undefined : state.filter);
  const remember = (items: AppNotification[]) => items.forEach((n) => cache.set(n.id, n));

  async function loadFirst(mode: 'initial' | 'refresh'): Promise<void> {
    if (!api || !state.ownerId) return;
    const current = ++generation;
    set(
      mode === 'refresh'
        ? { refreshing: true, error: null, loadMoreError: null }
        : { loading: true, error: null, loadMoreError: null, items: [], loaded: false, hasMore: false },
    );
    try {
      const page = await api.list({ page: 1, size, status: statusParam() });
      if (current !== generation) return;
      remember(page.items);
      position = Math.min(page.total, page.items.length);
      set({
        items: mergeNotifications([], page.items),
        total: page.total,
        hasMore: position < page.total,
        loaded: true,
        loading: false,
        refreshing: false,
      });
    } catch (cause) {
      if (current !== generation) return;
      set({ loading: false, refreshing: false, error: classifyNotificationError(cause) });
    }
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Usuario dueño de las notificaciones. Al cambiar, se descarta todo. */
    setOwner(ownerId: string | null, source: NotificationsApi): Promise<void> {
      if (ownerId === state.ownerId && source === api) return Promise.resolve();
      generation++;
      api = source;
      cache.clear();
      inFlight.clear();
      position = 0;
      state = { ...initial, ownerId };
      listeners.forEach((listener) => listener());
      return ownerId ? loadFirst('initial') : Promise.resolve();
    },

    setFilter(filter: NotificationFilter): Promise<void> {
      if (filter === state.filter && state.loaded) return Promise.resolve();
      set({ filter, markError: null });
      return loadFirst('initial');
    },

    refresh(): Promise<void> {
      if (!state.ownerId || state.loading || state.refreshing) return Promise.resolve();
      return loadFirst(state.loaded ? 'refresh' : 'initial');
    },

    /** Página siguiente desde la posición alcanzada (sin duplicar ni omitir). */
    async loadMore(): Promise<void> {
      if (!api || !state.ownerId || !state.hasMore || state.loadingMore || state.loading || state.refreshing) return;
      const current = generation;
      const page = Math.floor(position / size) + 1;
      set({ loadingMore: true, loadMoreError: null });
      try {
        const result = await api.list({ page, size, status: statusParam() });
        if (current !== generation) return;
        remember(result.items);
        position = Math.max(position, Math.min(result.total, (page - 1) * size + result.items.length));
        set({
          items: mergeNotifications(state.items, result.items),
          total: result.total,
          hasMore: position < result.total && result.items.length > 0,
          loadingMore: false,
        });
      } catch (cause) {
        if (current !== generation) return;
        set({ loadingMore: false, loadMoreError: classifyNotificationError(cause).message });
      }
    },

    /** Marca como leída (una sola llamada por notificación) y actualiza lista y detalle. */
    markRead(id: string): Promise<void> {
      const pending = inFlight.get(id);
      if (pending) return pending;
      const target = cache.get(id);
      if (!api || !target || target.status === 'read') return Promise.resolve();
      const source = api;
      const current = generation;
      set({ marking: [...state.marking, id], markError: null });
      const action = (async () => {
        try {
          await source.markRead(id);
          if (current !== generation) return;
          const updated: AppNotification = { ...target, status: 'read', readAt: now().toISOString() };
          cache.set(id, updated);
          const leavesFilter = state.filter !== 'all' && state.filter !== 'read';
          if (leavesFilter) {
            position = Math.max(0, position - 1);
            set({ items: state.items.filter((n) => n.id !== id), total: Math.max(0, state.total - 1) });
          } else {
            set({ items: state.items.map((n) => (n.id === id ? updated : n)) });
          }
        } catch (cause) {
          if (current !== generation) return;
          const error = classifyNotificationError(cause);
          if (error.kind === 'not_found') {
            cache.delete(id);
            set({ items: state.items.filter((n) => n.id !== id) });
          }
          set({ markError: { id, ...error } });
        } finally {
          inFlight.delete(id);
          if (current === generation) set({ marking: state.marking.filter((m) => m !== id) });
        }
      })();
      inFlight.set(id, action);
      return action;
    },

    /** Notificación ya listada (no existe GET individual en el backend). */
    get(id: string): AppNotification | null {
      return cache.get(id) ?? null;
    },
  };
}

/** Almacén compartido por la lista (app/notificaciones) y el detalle (app/notificacion/[id]). */
export const notificationsStore = createNotificationsStore();
