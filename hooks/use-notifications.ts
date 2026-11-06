import { useEffect, useSyncExternalStore } from 'react';

import { useAppState } from '@/hooks/use-app-state';
import { useAuth } from '@/hooks/use-auth';
import { backendNotificationsApi, notificationsStore } from '@/services/notifications';
import { demoNotificationsApi } from '@/services/notifications-demo';

/**
 * Conecta una pantalla al almacén de notificaciones del usuario actual.
 * Sesión real: notificaciones del usuario autenticado. Sesión demo: ejemplos.
 */
export function useNotifications() {
  const { sessionMode } = useAppState();
  const { user } = useAuth();
  const isBackend = sessionMode === 'backend';
  const ownerId = isBackend ? (user?.id ?? null) : 'demo';

  useEffect(() => {
    void notificationsStore.setOwner(ownerId, isBackend ? backendNotificationsApi : demoNotificationsApi);
  }, [ownerId, isBackend]);

  const state = useSyncExternalStore(
    notificationsStore.subscribe,
    notificationsStore.getState,
    notificationsStore.getState,
  );
  return { state, store: notificationsStore };
}
