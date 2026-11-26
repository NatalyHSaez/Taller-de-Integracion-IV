import type { PushReceptionPort } from '../../domain/push-reception';

let port: PushReceptionPort | undefined;
export function configurePushReception(value: PushReceptionPort): void { port = value; }
export function pushReceptionPort(): PushReceptionPort | undefined { return port; }
