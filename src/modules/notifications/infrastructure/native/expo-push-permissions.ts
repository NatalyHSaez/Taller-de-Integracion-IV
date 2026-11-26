import { canRequestPushPermission, type PushPermission, type PushPermissionPort } from '../../domain/push-permission';

export const PUSH_CHANNEL_ID = 'health-updates';
export type PushEnvironment = 'android' | 'ios' | 'web-or-other' | 'expo-go';
type NotificationsModule = Pick<typeof import('expo-notifications'),
  'getPermissionsAsync' | 'requestPermissionsAsync' | 'setNotificationChannelAsync' |
  'IosAuthorizationStatus' | 'AndroidImportance' | 'AndroidNotificationVisibility'>;

type NativePermission = Awaited<ReturnType<NotificationsModule['getPermissionsAsync']>>;

export async function ensureAndroidPushChannel(sdk: Pick<NotificationsModule, 'setNotificationChannelAsync' | 'AndroidImportance' | 'AndroidNotificationVisibility'>): Promise<void> {
  await sdk.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
    name: 'Avisos de salud',
    importance: sdk.AndroidImportance.DEFAULT,
    lockscreenVisibility: sdk.AndroidNotificationVisibility.PRIVATE,
  });
}

function normalize(raw: NativePermission, sdk: NotificationsModule, platform: 'android' | 'ios'): PushPermission {
  const canAskAgain = raw.canAskAgain === true;
  if (platform === 'ios' && raw.ios) {
    switch (raw.ios.status) {
      case sdk.IosAuthorizationStatus.AUTHORIZED: return { status: 'granted', canAskAgain };
      case sdk.IosAuthorizationStatus.PROVISIONAL: return { status: 'provisional', canAskAgain };
      case sdk.IosAuthorizationStatus.EPHEMERAL: return { status: 'ephemeral', canAskAgain };
      case sdk.IosAuthorizationStatus.DENIED: return { status: 'denied', canAskAgain };
      case sdk.IosAuthorizationStatus.NOT_DETERMINED: return { status: 'undetermined', canAskAgain };
      default: throw new Error('Estado de autorización iOS desconocido.');
    }
  }
  switch (raw.status) {
    case 'granted': return { status: 'granted', canAskAgain };
    case 'denied': return { status: 'denied', canAskAgain };
    case 'undetermined': return { status: 'undetermined', canAskAgain };
    default: throw new Error('Estado de permiso desconocido.');
  }
}

export function createExpoPushPermissions(
  environment: () => Promise<PushEnvironment>,
  load: () => Promise<NotificationsModule>,
): PushPermissionPort {
  async function run(request: boolean): Promise<PushPermission> {
    const platform = await environment();
    if (platform === 'web-or-other' || platform === 'expo-go') {
      return { status: 'unsupported', reason: platform, canAskAgain: false };
    }
    const sdk = await load();
    // La lectura de permiso no crea canales ni muestra diálogos.
    if (request && platform === 'android') {
      await ensureAndroidPushChannel(sdk);
    }
    const current = normalize(await sdk.getPermissionsAsync(), sdk, platform);
    if (!request || !canRequestPushPermission(current)) return current;
    return normalize(await sdk.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    }), sdk, platform);
  }
  return { get: () => run(false), request: () => run(true) };
}

export async function pushEnvironment(): Promise<PushEnvironment> {
  const { Platform } = await import('react-native');
  const os = Platform.OS;
  if (os !== 'android' && os !== 'ios') return 'web-or-other';
  const { isRunningInExpoGo } = await import('expo');
  if (isRunningInExpoGo()) return 'expo-go';
  return os;
}

export const expoPushPermissions = createExpoPushPermissions(pushEnvironment, () => import('expo-notifications'));
