import type { PushTokenPort } from '../../domain/push-token';

let port: PushTokenPort | undefined;
export function configurePushToken(value: PushTokenPort): void { port = value; }
export function pushTokenPort(): PushTokenPort {
  if (!port) throw new Error('Obtención de token push no configurada.');
  return port;
}
