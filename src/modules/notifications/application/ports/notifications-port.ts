import type { NotificationsApi } from '../../domain/notification';

let repository: NotificationsApi | undefined;

export function configureNotifications(value: NotificationsApi): void {
  repository = value;
}

export function notificationsRepository(): NotificationsApi {
  if (!repository) throw new Error('El módulo de notificaciones no está configurado.');
  return repository;
}
