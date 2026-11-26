import type { PushReceptionPort } from '../../domain/push-reception';
import { pushEnvironment, type PushEnvironment } from './expo-push-permissions';

type NotificationsModule = Pick<typeof import('expo-notifications'), 'addNotificationReceivedListener'>;

export function createExpoPushReception(
  environment: () => Promise<PushEnvironment>,
  load: () => Promise<NotificationsModule>,
): PushReceptionPort {
  return {
    async subscribe(onReceived) {
      const platform = await environment();
      if (platform !== 'android' && platform !== 'ios') return null;
      const sdk = await load();
      let active = true;
      // Ignorar el evento completo: no confiar en el contenido ni en sus identificadores.
      const subscription = sdk.addNotificationReceivedListener(() => {
        if (active) onReceived();
      });
      return () => {
        if (!active) return;
        active = false;
        subscription.remove();
      };
    },
  };
}

export const expoPushReception = createExpoPushReception(pushEnvironment, () => import('expo-notifications'));
