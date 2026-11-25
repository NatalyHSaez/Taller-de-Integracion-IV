import type { PushNavigationPort } from '../../domain/push-navigation';

let port: PushNavigationPort | undefined;
export function configurePushNavigation(value: PushNavigationPort): void { port = value; }
export function pushNavigationPort(): PushNavigationPort | undefined { return port; }
