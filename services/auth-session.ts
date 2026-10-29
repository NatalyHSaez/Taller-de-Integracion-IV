import type { AuthTokensResponse, CurrentUserResponse } from '@/types/api';

export type AuthSessionMode = 'backend' | 'mock';
export type SessionState = {
  mode: AuthSessionMode | null;
  tokens: AuthTokensResponse | null;
  user: CurrentUserResponse | null;
};

let state: SessionState = { mode: null, tokens: null, user: null };
let sessionGeneration = 0;
const listeners = new Set<() => void>();

function publish(next: SessionState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

/** Única fuente observable de sesión. Los tokens reales también se guardan en SecureStore. */
export const authSession = {
  snapshot: () => state,
  generation: () => sessionGeneration,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  mode: () => state.mode,
  tokens: () => state.tokens,
  user: () => state.user,
  accessToken: () => state.mode === 'backend' ? state.tokens?.accessToken ?? null : null,
  refreshToken: () => state.mode === 'backend' ? state.tokens?.refreshToken ?? null : null,
  startBackend(tokens: AuthTokensResponse, user: CurrentUserResponse | null = null) {
    sessionGeneration += 1;
    publish({ mode: 'backend', tokens, user });
  },
  /** La rotación no inicia otra sesión ni hace desaparecer temporalmente a su usuario. */
  rotateBackendTokens(tokens: AuthTokensResponse): void {
    if (state.mode !== 'backend') return;
    publish({ ...state, tokens });
  },
  startMock(tokens: AuthTokensResponse, user: CurrentUserResponse) {
    sessionGeneration += 1;
    publish({ mode: 'mock', tokens, user });
  },
  setUser(user: CurrentUserResponse | null): void {
    if (!state.mode) return;
    publish({ ...state, user });
  },
  clear(): void {
    sessionGeneration += 1;
    publish({ mode: null, tokens: null, user: null });
  },
};
