import type { PushTokenResult } from './push-token';

/** Contrato interno, no representa un DTO HTTP acordado con el backend. */
export type PushDeviceRegistration = Omit<Extract<PushTokenResult, { status: 'ready' }>, 'status'>;

/** El adaptador futuro debe vincular la petición a esta identidad autenticada. */
export type PushDeviceOperationScope = { ownerId: string; signal: AbortSignal };

export type PushDevicePort = {
  register(input: PushDeviceRegistration, scope: PushDeviceOperationScope): Promise<unknown>;
  unregister(deviceId: string, scope: PushDeviceOperationScope): Promise<unknown>;
};

export type PushDeviceResult = {
  status: 'registered' | 'unregistered' | 'backend-not-configured' | 'session-changed' |
    'busy' | 'not-confirmed' | 'unconfirmed' | 'unsupported' | 'permission-required' |
    'project-not-configured' | 'unavailable';
};

/** Identificador opaco de instalación asignado por el servidor, no un token Expo. */
export function isPushDeviceId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

/** Confirmación normalizada por el adaptador futuro, nunca una respuesta HTTP asumida. */
export function confirmedPushDeviceId(value: unknown, status: 'registered' | 'unregistered'): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const receipt = value as { status?: unknown; deviceId?: unknown };
  return receipt.status === status && isPushDeviceId(receipt.deviceId) ? receipt.deviceId : null;
}
