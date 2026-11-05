import type { AuthTokensResponse, CurrentUserResponse } from '@/types/api';
import { setApiAccessTokenProvider, invalidateApiSession } from './api';

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

/**
 * Sesión temporal de autenticación.
 *
 * Representación en memoria de los tokens persistidos por token-storage.
 * Publica cambios de identidad y renovación para el resto de la aplicación.
 */
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
  accessToken: () => state.tokens?.accessToken ?? null,
  refreshToken: () => state.tokens?.refreshToken ?? null,

  startBackend(tokens: AuthTokensResponse) {
    invalidateApiSession();
    replaceState({
      mode: 'backend',
      tokens,
      user: null,
    });
  },

  startMock(tokens: AuthTokensResponse, user: CurrentUserResponse) {
    invalidateApiSession();
    replaceState({
      mode: 'mock',
      tokens,
      user,
    });
  },

  updateTokens(tokens: AuthTokensResponse) {
    if (state.mode === 'backend') replaceState({ ...state, tokens });
  },

  setUser(user: CurrentUserResponse) {
    replaceState({
      ...state,
      user,
    });
  },

  clear() {
    invalidateApiSession();
    replaceState({
      mode: null,
      tokens: null,
      user: null,
    });
  },
};

// apiClient obtiene siempre el token desde un único punto.
setApiAccessTokenProvider(() => authSession.accessToken());
