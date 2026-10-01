import type { AuthTokensResponse, CurrentUserResponse } from '@/types/api';
import { setApiAccessTokenProvider } from './api';

export type AuthSessionMode = 'backend' | 'mock';

type SessionState = {
  mode: AuthSessionMode | null;
  tokens: AuthTokensResponse | null;
  user: CurrentUserResponse | null;
};

let state: SessionState = {
  mode: null,
  tokens: null,
  user: null,
};

/**
 * Sesión temporal de autenticación.
 *
 * Por ahora los tokens quedan solo en memoria. Esto permite conectar el login real
 * sin mezclar todavía esta etapa con expo-secure-store. En una etapa posterior se
 * podrá cambiar la persistencia sin modificar apiClient ni las pantallas.
 */
export const authSession = {
  mode: () => state.mode,
  tokens: () => state.tokens,
  user: () => state.user,
  accessToken: () => state.tokens?.access_token ?? null,
  refreshToken: () => state.tokens?.refresh_token ?? null,

  startBackend(tokens: AuthTokensResponse) {
    state = {
      mode: 'backend',
      tokens,
      user: null,
    };
  },

  startMock(tokens: AuthTokensResponse, user: CurrentUserResponse) {
    state = {
      mode: 'mock',
      tokens,
      user,
    };
  },

  setUser(user: CurrentUserResponse) {
    state = {
      ...state,
      user,
    };
  },

  clear() {
    state = {
      mode: null,
      tokens: null,
      user: null,
    };
  },
};

// apiClient obtiene siempre el token desde un único punto.
setApiAccessTokenProvider(() => authSession.accessToken());
