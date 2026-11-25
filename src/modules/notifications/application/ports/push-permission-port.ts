import type { PushPermissionPort } from '../../domain/push-permission';

let port: PushPermissionPort | undefined;

export function configurePushPermissions(value: PushPermissionPort): void {
  port = value;
}

export function pushPermissionPort(): PushPermissionPort {
  if (!port) throw new Error('Permisos de notificaciones no configurados.');
  return port;
}
