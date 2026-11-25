import { authSession } from '@/src/core/application/session/auth-session';
import { appState } from '@/src/core/application/session/app-state';
import { pushNavigationPort } from '../ports/push-navigation-port';

function currentSession(): string | null {
  const id = authSession.user()?.id;
  return authSession.mode() === 'backend' && id && authSession.accessToken()
    ? JSON.stringify([authSession.generation(), id]) : null;
}

function canOpenNotifications(): boolean {
  const state = appState.snapshot();
  return currentSession() !== null && state.sessionMode === 'backend' &&
    state.user?.id === authSession.user()?.id &&
    (state.user?.role === 'patient' || (state.user?.role === 'caregiver' && state.hasSelectedPatient));
}

/** Solo permite abrir el listado propio; no retiene pulsaciones para un login posterior. */
export function startPushNavigation(openNotifications: () => void): () => void {
  const initialSession = currentSession();
  let stopped = false;
  let remove: (() => void) | null = null;
  function dispose(cleanup: (() => void) | null) {
    try { cleanup?.(); } catch { /* No revelar datos del SDK. */ }
  }
  const port = pushNavigationPort();
  if (port) {
    void Promise.resolve().then(() => {
      if (stopped) return null;
      return port.subscribe(origin => {
        if (stopped || !canOpenNotifications()) return;
        if (origin === 'initial' && (!initialSession || initialSession !== currentSession())) return;
        // El destino no procede del aviso. No se leen ni modifican pacientes o notificaciones aquí.
        try { openNotifications(); } catch { /* El router aún puede no estar listo; no reintentar automáticamente. */ }
      });
    }).then(cleanup => {
      if (stopped) dispose(cleanup);
      else remove = cleanup;
    }).catch(() => { /* Fallar cerrado; navegación manual disponible. */ });
  }
  return () => {
    if (stopped) return;
    stopped = true;
    dispose(remove);
    remove = null;
  };
}
