import { useSyncExternalStore } from 'react';
import { demo, type Permissions } from '@/services/demo-store';
import { authSession } from '@/services/auth-session';
const denied: Permissions = { alerts: false, read: false, write: false };
/** Los modelos ficticios nunca deben mezclarse con una sesión real. */
export function useDemo() {
  useSyncExternalStore(authSession.subscribe, authSession.snapshot, authSession.snapshot);
  const state = useSyncExternalStore(demo.subscribe, demo.snapshot, demo.snapshot);
  if (authSession.mode() !== 'mock') {
    return { ...state, accounts: [], profiles: [], invitations: [], relations: [], measurements: [],
      user: undefined, patient: undefined, patients: [], permissions: denied };
  }
  return { ...state, user: demo.user(), patient: demo.patient(),
    patients: demo.patients(), permissions: demo.permissions(), measurements: demo.measurements() };
}
