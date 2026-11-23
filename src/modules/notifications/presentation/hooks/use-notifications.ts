import { useEffect, useSyncExternalStore } from 'react';

import { authSession } from '@/src/core/application/session/auth-session';
import { useAppState } from '@/src/core/presentation/session/use-app-state';
import { useAuth } from '@/src/modules/identity/presentation/hooks/use-auth';
import { backendNotificationsApi } from '@/src/modules/notifications/infrastructure/notifications-api';
import { notificationsStore } from '@/src/modules/notifications/application/notifications';

/**
 * Conecta una pantalla al almacén de notificaciones del usuario actual.
 * Solo notificaciones del usuario autenticado contra el backend.
 */
export function useNotifications() {
  const { sessionMode } = useAppState();
  const { user } = useAuth();
  // Una misma cuenta puede abrir otra sesión: el número de generación
  // permite invalidar cualquier notificación anterior sin cambiar ownerId.
  useSyncExternalStore(authSession.subscribe, authSession.snapshot, authSession.snapshot);
  const sessionRevision = authSession.generation();
  const isBackend = sessionMode === 'backend';
  const ownerId = isBackend ? (user?.id ?? null) : null;

  useEffect(() => {
    void notificationsStore.setOwner(ownerId, backendNotificationsApi, sessionRevision);
  }, [ownerId, sessionRevision]);

  const state = useSyncExternalStore(
    notificationsStore.subscribe,
    notificationsStore.getState,
    notificationsStore.getState,
  );
  return { state, store: notificationsStore };
}
