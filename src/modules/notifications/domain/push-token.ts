/** Identificador de entrega Expo, nunca una credencial de autenticación. */
export type PushTokenResult =
  | { status: 'ready'; token: string; projectId: string; platform: 'android' | 'ios' }
  | { status: 'unsupported' | 'permission-required' | 'project-not-configured' | 'session-changed' | 'unavailable' };

export type PushTokenPort = { obtain(): Promise<PushTokenResult> };

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && /^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]{1,512}\]$/.test(value);
}

export function isPushProjectId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) && value !== '00000000-0000-0000-0000-000000000000';
}
