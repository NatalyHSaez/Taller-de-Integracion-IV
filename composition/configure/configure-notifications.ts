import { configureNotifications } from '../../src/modules/notifications/application/ports/notifications-port';
import { backendNotificationsApi } from '../../src/modules/notifications/infrastructure/api/notifications-api';
import { configurePushPermissions } from '../../src/modules/notifications/application/ports/push-permission-port';
import { expoPushPermissions } from '../../src/modules/notifications/infrastructure/native/expo-push-permissions';
import { configurePushToken } from '../../src/modules/notifications/application/ports/push-token-port';
import { expoPushToken } from '../../src/modules/notifications/infrastructure/native/expo-push-token';

configureNotifications(backendNotificationsApi);
configurePushPermissions(expoPushPermissions);
configurePushToken(expoPushToken);
