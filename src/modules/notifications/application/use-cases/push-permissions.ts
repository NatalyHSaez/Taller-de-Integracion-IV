import type { PushPermission } from '../../domain/push-permission';
import { pushPermissionPort } from '../ports/push-permission-port';

let pending: Promise<PushPermission> | undefined;

/** Consultar nunca abre el diálogo de permisos. */
export async function getPushPermission(): Promise<PushPermission> {
  return pushPermissionPort().get();
}

/** Llamar únicamente desde una acción explícita del usuario. */
export function requestPushPermission(): Promise<PushPermission> {
  if (pending) return pending;
  const operation = Promise.resolve().then(() => pushPermissionPort().request());
  pending = operation.finally(() => { pending = undefined; });
  return pending;
}
