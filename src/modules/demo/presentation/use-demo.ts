import { useSyncExternalStore } from 'react';
import { authSession } from '@/src/core/application/session/auth-session';
import { demo, type Permissions } from '@/src/modules/demo/infrastructure/demo-store';

const deniedPermissions: Permissions = { alerts: false, read: false, write: false };

/**
 * La UI solo obtiene datos ficticios durante el flujo de demostración.
 * Para la sesión real, la identidad y los vínculos provienen de appState y el Gateway.
 * Se preserva pendingToken antes del login para retomar una invitación simulada.
 */
export function useDemo() {
  const session = useSyncExternalStore(authSession.subscribe, authSession.snapshot, authSession.snapshot);
  const state = useSyncExternalStore(demo.subscribe, demo.snapshot, demo.snapshot);

  if (session.mode === 'backend') {
    return {
      ...state,
      accounts: [],
      profiles: [],
      invitations: [],
      relations: [],
      measurements: [],
      userId: undefined,
      selectedId: undefined,
      pendingToken: undefined,
      user: undefined,
      patient: undefined,
      patients: [],
      permissions: deniedPermissions,
    };
  }

  return {
    ...state,
    user: demo.user(),
    patient: demo.patient(),
    patients: demo.patients(),
    permissions: demo.permissions(),
    measurements: demo.measurements(),
  };
}
