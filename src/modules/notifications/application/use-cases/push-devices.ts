import { authSession } from '@/src/core/application/session/auth-session';
import { confirmedPushDeviceId, type PushDevicePort, type PushDeviceResult } from '../../domain/push-device';
import { isExpoPushToken, isPushProjectId } from '../../domain/push-token';
import { pushDevicePort } from '../ports/push-device-port';
import { obtainPushToken } from './push-token';

type Session = { ownerId: string; key: string };
type Action = 'register' | 'unregister';
function currentSession(): Session | null {
  const ownerId = authSession.user()?.id;
  if (authSession.mode() !== 'backend' || !ownerId || !authSession.accessToken()) return null;
  return { ownerId, key: JSON.stringify([authSession.generation(), ownerId]) };
}

/** La confirmación solo vive en memoria, vinculada a la sesión que la recibió. */
let receipt: { key: string; deviceId: string } | undefined;
let active: { key: string; action: Action; operation: Promise<PushDeviceResult> } | undefined;
authSession.subscribe(() => {
  if (receipt && receipt.key !== currentSession()?.key) receipt = undefined;
});

function run(action: Action): Promise<PushDeviceResult> {
  const session = currentSession();
  if (!session) return Promise.resolve({ status: 'session-changed' });
  const port = pushDevicePort();
  if (!port) return Promise.resolve({ status: 'backend-not-configured' });
  if (active) {
    if (active.key === session.key && active.action === action) return active.operation;
    return Promise.resolve({ status: 'busy' });
  }
  const controller = new AbortController();
  const isCurrent = () => !controller.signal.aborted && currentSession()?.key === session.key;
  const unsubscribe = authSession.subscribe(() => {
    if (currentSession()?.key !== session.key) controller.abort();
  });
  const operation = Promise.resolve().then(async (): Promise<PushDeviceResult> => {
    if (!isCurrent()) return { status: 'session-changed' };
    try {
      return await execute(action, session, port, controller.signal, isCurrent);
    } catch {
      // No se revelan tokens, identificadores o mensajes crudos del proveedor.
      // Un fallo de red no prueba que una escritura remota no haya ocurrido.
      return { status: isCurrent() ? 'unconfirmed' : 'session-changed' };
    }
  });
  const tracked = operation.finally(() => {
    unsubscribe();
    if (active?.operation === tracked) active = undefined;
  });
  active = { key: session.key, action, operation: tracked };
  return tracked;
}

async function execute(action: Action, session: Session, port: PushDevicePort, signal: AbortSignal, isCurrent: () => boolean): Promise<PushDeviceResult> {
  const scope = { ownerId: session.ownerId, signal };
  if (action === 'unregister') {
    if (receipt?.key !== session.key) return { status: 'not-confirmed' };
    const id = receipt.deviceId;
    // La desvinculación no exige que el permiso del sistema siga concedido.
    const response = await port.unregister(id, scope);
    if (!isCurrent()) return { status: 'session-changed' };
    if (confirmedPushDeviceId(response, 'unregistered') !== id) return { status: 'unconfirmed' };
    receipt = undefined;
    return { status: 'unregistered' };
  }
  const token = await obtainPushToken();
  if (!isCurrent()) return { status: 'session-changed' };
  if (token.status !== 'ready') return { status: token.status };
  if (!isExpoPushToken(token.token) || !isPushProjectId(token.projectId) ||
      (token.platform !== 'android' && token.platform !== 'ios')) return { status: 'unavailable' };
  const response = await port.register({ token: token.token, projectId: token.projectId, platform: token.platform }, scope);
  if (!isCurrent()) return { status: 'session-changed' };
  const id = confirmedPushDeviceId(response, 'registered');
  if (id === null) return { status: 'unconfirmed' };
  receipt = { key: session.key, deviceId: id };
  return { status: 'registered' };
}

/** Acción explícita, no se ejecuta al iniciar sesión ni al arrancar la aplicación. */
export function registerPushDevice(): Promise<PushDeviceResult> { return run('register'); }

/** Solo desvincula un dispositivo confirmado para la sesión actual. */
export function unregisterPushDevice(): Promise<PushDeviceResult> { return run('unregister'); }
