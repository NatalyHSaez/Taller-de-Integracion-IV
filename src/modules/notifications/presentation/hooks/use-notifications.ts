import { useEffect, useSyncExternalStore } from 'react';
import { authSession } from '@/src/core/application/session/auth-session';
import { notificationsStore, selectNotificationOwner } from '@/src/modules/notifications/application/notifications';

/** Vincula las notificaciones exclusivamente a la sesión autenticada. */
export function useNotifications() {
  const session = useSyncExternalStore(authSession.subscribe, authSession.snapshot, authSession.snapshot);
  const sessionRevision = authSession.generation();
  const ownerId = session.mode === 'backend' ? (session.user?.id ?? null) : null;

  useEffect(() => {
    void selectNotificationOwner(ownerId, sessionRevision);
  }, [ownerId, sessionRevision]);

  const state = useSyncExternalStore(
    notificationsStore.subscribe,
    notificationsStore.getState,
    notificationsStore.getState,
  );
  const ownerReady = notificationsStore.isOwner(ownerId, sessionRevision);
  return { state, store: notificationsStore, ownerId, ownerReady, sessionRevision };
}
