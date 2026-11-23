import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

// En Android/iOS se utiliza SecureStore (Keystore/Keychain).
// En web, sessionStorage es solo una alternativa para desarrollo: sigue siendo
// accesible desde JavaScript y NO ofrece la seguridad de SecureStore.
const isWeb = Platform.OS === 'web';

// Serializa escrituras, rotaciones y cierres de sesión para que no se crucen.
let writes: Promise<void> = Promise.resolve();

function enqueue(action: () => Promise<void>): Promise<void> {
  const next = writes.then(action);
  // Un fallo individual no debe bloquear las operaciones siguientes.
  writes = next.catch(() => {});
  return next;
}

function webSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    // Algunos navegadores o contextos restringidos bloquean el almacenamiento.
    return null;
  }
}

function removeLegacyWebToken(key: string): void {
  try {
    // Versiones anteriores guardaban tokens web en localStorage. Nunca se
    // recuperan desde allí: se eliminan para evitar persistencia innecesaria.
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {
    // Fallar al borrar una clave antigua no debe impedir limpiar la sesión actual.
  }
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    const storage = webSessionStorage();
    if (!storage) throw new Error('El almacenamiento temporal del navegador no está disponible.');
    storage.setItem(key, value);
    removeLegacyWebToken(key);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    removeLegacyWebToken(key);
    return webSessionStorage()?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      webSessionStorage()?.removeItem(key);
    } finally {
      removeLegacyWebToken(key);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await enqueue(async () => {
    try {
      await setItem(ACCESS_TOKEN_KEY, accessToken);
      await setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch (error) {
      // Si falla el segundo guardado, no dejamos una sesión incompleta.
      await Promise.allSettled([
        deleteItem(ACCESS_TOKEN_KEY),
        deleteItem(REFRESH_TOKEN_KEY),
      ]);
      throw error;
    }
  });
}

export async function getAccessToken(): Promise<string | null> {
  await writes;
  return getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  await writes;
  return getItem(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  await enqueue(async () => {
    // allSettled intenta borrar ambas claves incluso si falla una de ellas.
    const results = await Promise.allSettled([
      deleteItem(ACCESS_TOKEN_KEY),
      deleteItem(REFRESH_TOKEN_KEY),
    ]);
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) throw failed.reason;
  });
}
