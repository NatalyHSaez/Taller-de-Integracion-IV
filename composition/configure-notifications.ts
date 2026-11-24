import { configureNotifications } from '../src/modules/notifications/application/notifications-port';
import { backendNotificationsApi } from '../src/modules/notifications/infrastructure/notifications-api';

configureNotifications(backendNotificationsApi);
