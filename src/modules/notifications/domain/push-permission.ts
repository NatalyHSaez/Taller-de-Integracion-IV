/** Permiso del sistema operativo; no equivale a registro push en el backend. */
export type PushPermission =
  | { status: 'unsupported'; reason: 'web-or-other' | 'expo-go'; canAskAgain: false }
  | { status: 'undetermined' | 'denied' | 'granted' | 'provisional' | 'ephemeral'; canAskAgain: boolean };

export type PushPermissionPort = {
  get(): Promise<PushPermission>;
  request(): Promise<PushPermission>;
};

export function canRequestPushPermission(permission: PushPermission): boolean {
  return permission.canAskAgain && (permission.status === 'undetermined' || permission.status === 'denied');
}
