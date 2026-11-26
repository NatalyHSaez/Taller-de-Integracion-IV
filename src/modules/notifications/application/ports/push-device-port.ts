import type { PushDevicePort } from '../../domain/push-device';

let port: PushDevicePort | undefined;

/** No se configura hasta contar con un adaptador real y el contrato de Integra II. */
export function configurePushDevices(value: PushDevicePort): void { port = value; }

export function pushDevicePort(): PushDevicePort | undefined { return port; }
