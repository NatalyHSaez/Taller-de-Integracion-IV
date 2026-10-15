import type { AuthTokensResponse, CurrentUserResponse } from '@/types/api';
import { setApiAccessTokenProvider } from './api';

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
 * Por ahora los tokens quedan solo en memoria. Además de exponer el token al
 * cliente HTTP, la sesión publica cambios para que el estado global de la app
 * pueda reaccionar cuando cambia entre backend, mock o sesión cerrada.
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
  accessToken: () => state.tokens?.access_token ?? null,
  refreshToken: () => state.tokens?.refresh_token ?? null,

  startBackend(tokens: AuthTokensResponse) {
    replaceState({
      mode: 'backend',
      tokens,
      user: null,
    });
  },

  startMock(tokens: AuthTokensResponse, user: CurrentUserResponse) {
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

// apiClient obtiene siempre el token desde un único punto.
setApiAccessTokenProvider(() => authSession.accessToken());
