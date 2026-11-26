import { authSession } from '@/src/core/application/session/auth-session';
import { pushReceptionPort } from '../ports/push-reception-port';
import { notificationsStore } from './notifications';

function currentOwner() {
  const id = authSession.user()?.id;
  return authSession.mode() === 'backend' && id && authSession.accessToken()
    ? { id, revision: authSession.generation(), key: JSON.stringify([authSession.generation(), id]) }
    : null;
}

function dispose(remove: (() => void) | null): void {
  try { remove?.(); } catch { /* No exponer errores nativos ni contenido del aviso. */ }
}

/** Ciclo de vida del listener mientras existe una sesión backend. No navega ni registra dispositivos. */
export function startPushReception(): () => void {
  let stopped = false;
  let key: string | null = null;
  let sequence = 0;
  let remove: (() => void) | null = null;
  let pending = false;
  let scheduled = false;

  function drain(): void {
    if (stopped || !pending || scheduled) return;
    scheduled = true;
    void Promise.resolve().then(() => {
      scheduled = false;
      if (stopped || !pending) return;
      const owner = currentOwner();
      if (!owner || owner.key !== key || !notificationsStore.isOwner(owner.id, owner.revision)) {
        pending = false;
        return;
      }
      const state = notificationsStore.getState();
      // No invalidar una operación de marcado o paginación que aún está en curso.
      if (state.loading || state.refreshing || state.loadingMore || state.marking.length > 0) return;
      pending = false;
      // El listado es la única fuente de contenido; refresh usa el repositorio real.
      void notificationsStore.refresh().catch(() => { /* El listado conserva sus errores habituales. */ });
    });
  }

  function sync(): void {
    if (stopped) return;
    const owner = currentOwner();
    const next = owner?.key ?? null;
    if (next === key) return;
    key = next;
    const revision = ++sequence;
    pending = false;
    dispose(remove);
    remove = null;
    const port = pushReceptionPort();
    if (!owner || !port) return;
    const valid = () => !stopped && revision === sequence && currentOwner()?.key === owner.key;
    void Promise.resolve().then(() => {
      if (!valid()) return null;
      return port.subscribe(() => {
        if (!valid() || !notificationsStore.isOwner(owner.id, owner.revision)) return;
        pending = true;
        drain();
      });
    }).then(cleanup => {
      if (!valid()) dispose(cleanup);
      else remove = cleanup;
    }).catch(() => { /* No bloquear la app ni declarar recepción disponible. */ });
  }

  const unsubscribeSession = authSession.subscribe(sync);
  const unsubscribeStore = notificationsStore.subscribe(drain);
  sync();
  return () => {
    if (stopped) return;
    stopped = true;
    sequence++;
    pending = false;
    unsubscribeSession();
    unsubscribeStore();
    dispose(remove);
    remove = null;
  };
}
