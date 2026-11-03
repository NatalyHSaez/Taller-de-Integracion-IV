import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

const isWeb = Platform.OS === 'web';
let writes: Promise<void> = Promise.resolve();
function enqueue(action: () => Promise<void>) {
  const next = writes.then(action);
  writes = next.catch(() => {});
  return next;
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveTokens(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await enqueue(async () => {
    try {
      await setItem(ACCESS_TOKEN_KEY, accessToken);
      await setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch (error) {
      await Promise.allSettled([deleteItem(ACCESS_TOKEN_KEY), deleteItem(REFRESH_TOKEN_KEY)]);
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
    await Promise.all([deleteItem(ACCESS_TOKEN_KEY), deleteItem(REFRESH_TOKEN_KEY)]);
  });
}
