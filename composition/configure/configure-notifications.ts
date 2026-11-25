import { configureNotifications } from '../../src/modules/notifications/application/ports/notifications-port';
import { backendNotificationsApi } from '../../src/modules/notifications/infrastructure/api/notifications-api';

configureNotifications(backendNotificationsApi);
