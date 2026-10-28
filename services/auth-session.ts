
import type {
  AuthTokensResponse,
  CurrentUserResponse,
} from '@/types/api';
import { setApiAccessTokenProvider } from './api';
import { getAccessToken } from './token-storage';

export type AuthSessionMode = 'backend' | 'mock';

export type SessionState = {
  mode: AuthSessionMode | null;
  tokens: AuthTokensResponse | null;
  user: CurrentUserResponse | null;
};

let state: SessionState = {
  mode: null,
  tokens: null,
  user: null,
};

const listeners = new Set<() => void>();

function replaceState(nextState: SessionState) {
  state = nextState;
  listeners.forEach((listener) => listener());
}

export const authSession = {
  snapshot: () => state,

  subscribe(listener: () => void) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },

  mode: () => state.mode,
  tokens: () => state.tokens,
  user: () => state.user,

  accessToken: () =>
    state.tokens?.access_token ?? null,

  refreshToken: () =>
    state.tokens?.refresh_token ?? null,

  startBackend(tokens: AuthTokensResponse) {
    replaceState({
      mode: 'backend',
      tokens,
      user: null,
    });
  },

  startMock(
    tokens: AuthTokensResponse,
    user: CurrentUserResponse,
  ) {
    replaceState({
      mode: 'mock',
      tokens,
      user,
    });
  },

  setUser(user: CurrentUserResponse) {
    replaceState({
      ...state,
      user,
    });
  },

  clear() {
    replaceState({
      mode: null,
      tokens: null,
      user: null,
    });
  },
};

// Las sesiones reales consultan el token actualizado
// en SecureStore. Las sesiones mock conservan su token
// en memoria.
setApiAccessTokenProvider(async () => {
  if (authSession.mode() === 'mock') {
    return authSession.accessToken();
  }

  if (authSession.mode() !== 'backend') {
    return null;
  }

  return await getAccessToken();
});
