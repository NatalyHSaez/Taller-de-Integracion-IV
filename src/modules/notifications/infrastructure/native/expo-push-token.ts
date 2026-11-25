import { isExpoPushToken, isPushProjectId, type PushTokenPort } from '../../domain/push-token';
import { ensureAndroidPushChannel, pushEnvironment, type PushEnvironment } from './expo-push-permissions';

type SDK = Pick<typeof import('expo-notifications'), 'getExpoPushTokenAsync' | 'setNotificationChannelAsync' | 'AndroidImportance' | 'AndroidNotificationVisibility'>;
export function resolvePushProjectId(manifestId: unknown, easId: unknown): string | null {
  if (manifestId != null && !isPushProjectId(manifestId)) return null;
  if (easId != null && !isPushProjectId(easId)) return null;
  if (typeof manifestId === 'string' && typeof easId === 'string' && manifestId.toLowerCase() !== easId.toLowerCase()) return null;
  const id = manifestId ?? easId;
  return isPushProjectId(id) ? id : null;
}

export function createExpoPushToken(
  environment: () => Promise<PushEnvironment>,
  projectId: () => Promise<string | null>,
  load: () => Promise<SDK>,
): PushTokenPort {
  return {
    async obtain() {
      const platform = await environment();
      if (platform !== 'android' && platform !== 'ios') return { status: 'unsupported' };
      const id = await projectId();
      if (!isPushProjectId(id)) return { status: 'project-not-configured' };
      const sdk = await load();
      if (platform === 'android') {
        await ensureAndroidPushChannel(sdk);
      }
      const result = await sdk.getExpoPushTokenAsync({ projectId: id });
      if (result.type !== 'expo' || !isExpoPushToken(result.data)) return { status: 'unavailable' };
      return { status: 'ready', token: result.data, projectId: id, platform };
    },
  };
}

export const expoPushToken = createExpoPushToken(pushEnvironment, async () => {
  const { default: Constants } = await import('expo-constants');
  return resolvePushProjectId(Constants.expoConfig?.extra?.eas?.projectId, Constants.easConfig?.projectId);
}, () => import('expo-notifications'));
