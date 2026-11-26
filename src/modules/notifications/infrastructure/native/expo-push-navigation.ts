import type { PushNavigationPort } from '../../domain/push-navigation';
import { pushEnvironment, type PushEnvironment } from './expo-push-permissions';

type NotificationsModule = Pick<typeof import('expo-notifications'),
  'addNotificationResponseReceivedListener' | 'getLastNotificationResponse' |
  'clearLastNotificationResponse' | 'DEFAULT_ACTION_IDENTIFIER'>;
type Response = NonNullable<ReturnType<NotificationsModule['getLastNotificationResponse']>>;
const MAX_SEEN = 128;

function identifier(response: Response): string | null {
  const id = response.notification?.request?.identifier;
  return typeof id === 'string' && id.trim().length > 0 && id.length <= 512 ? id : null;
}

export function createExpoPushNavigation(
  environment: () => Promise<PushEnvironment>,
  load: () => Promise<NotificationsModule>,
): PushNavigationPort {
  return {
    async subscribe(onOpen) {
      const platform = await environment();
      if (platform !== 'android' && platform !== 'ios') return null;
      const sdk = await load();
      let active = true;
      const seen = new Set<string>();
      function handle(response: Response, initial: boolean) {
        if (!active) return;
        const id = identifier(response);
        try {
          // Consumir la última respuesta solo si sigue siendo la misma. Nunca leer data/content.
          const latest = sdk.getLastNotificationResponse();
          if (latest && (initial || (id !== null && identifier(latest) === id &&
              latest.actionIdentifier === response.actionIdentifier))) {
            sdk.clearLastNotificationResponse();
          }
        } catch { return; } // No repetir navegación si no podemos consumir la respuesta.
        if (!id || response.actionIdentifier !== sdk.DEFAULT_ACTION_IDENTIFIER || seen.has(id)) return;
        seen.add(id);
        if (seen.size > MAX_SEEN) {
          const oldest = seen.values().next().value;
          if (oldest !== undefined) seen.delete(oldest);
        }
        onOpen(initial ? 'initial' : 'live');
      }
      const subscription = sdk.addNotificationResponseReceivedListener(response => handle(response, false));
      // Listener primero: si el SDK entrega también el último evento, el identificador lo deduplica.
      try {
        const initial = sdk.getLastNotificationResponse();
        if (initial) handle(initial, true);
      } catch { /* Un fallo de lectura inicial no impide escuchar pulsaciones nuevas. */ }
      return () => {
        if (!active) return;
        active = false;
        seen.clear();
        subscription.remove();
      };
    },
  };
}

export const expoPushNavigation = createExpoPushNavigation(pushEnvironment, () => import('expo-notifications'));
