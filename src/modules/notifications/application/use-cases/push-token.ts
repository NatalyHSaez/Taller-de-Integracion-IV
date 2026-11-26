import { authSession } from '@/src/core/application/session/auth-session';
import { isExpoPushToken, isPushProjectId, type PushTokenResult } from '../../domain/push-token';
import type { PushPermission } from '../../domain/push-permission';
import { pushTokenPort } from '../ports/push-token-port';
import { getPushPermission } from './push-permissions';

function ownerKey(): string | null {
  const user = authSession.user();
  return authSession.mode() === 'backend' && user?.id && authSession.accessToken()
    ? JSON.stringify([authSession.generation(), user.id]) : null;
}
function allowed(permission: PushPermission): boolean {
  return permission.status === 'granted' || permission.status === 'provisional' || permission.status === 'ephemeral';
}
let pending: { key: string; operation: Promise<PushTokenResult> } | undefined;

/** Acción explícita. No persiste el token ni lo envía al Gateway. */
export function obtainPushToken(): Promise<PushTokenResult> {
  const key = ownerKey();
  if (key === null) return Promise.resolve({ status: 'session-changed' });
  if (pending?.key === key) return pending.operation;
  const operation = (async (): Promise<PushTokenResult> => {
    try {
      const permission = await getPushPermission();
      if (ownerKey() !== key) return { status: 'session-changed' };
      if (permission.status === 'unsupported') return { status: 'unsupported' };
      if (!allowed(permission)) return { status: 'permission-required' };
      const result = await pushTokenPort().obtain();
      if (ownerKey() !== key) return { status: 'session-changed' };
      if (result.status !== 'ready') return result;
      if (!isExpoPushToken(result.token) || !isPushProjectId(result.projectId)) return { status: 'unavailable' };
      const current = await getPushPermission();
      if (ownerKey() !== key) return { status: 'session-changed' };
      if (current.status === 'unsupported') return { status: 'unsupported' };
      if (!allowed(current)) return { status: 'permission-required' };
      return result;
    } catch {
      // No propagar errores del proveedor: pueden incluir identificadores o tokens.
      return { status: ownerKey() === key ? 'unavailable' : 'session-changed' };
    }
  })();
  const tracked: Promise<PushTokenResult> = operation.finally(() => { if (pending?.operation === tracked) pending = undefined; });
  pending = { key, operation: tracked };
  return tracked;
}

/** La presentación recibe únicamente el estado, nunca el identificador de entrega. */
export async function preparePushToken(): Promise<PushTokenResult['status']> {
  return (await obtainPushToken()).status;
}
