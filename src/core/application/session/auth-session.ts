import type {
  AuthTokensResponse,
  CurrentUserResponse,
} from "@/src/core/domain/contracts";

export type AuthSessionMode = "backend";
export type SessionEndReason = "expired" | null;

export type SessionState = {
  mode: AuthSessionMode | null;
  tokens: AuthTokensResponse | null;
  user: CurrentUserResponse | null;
  endReason: SessionEndReason;
};

/** Estado observable. Las credenciales reales se persisten por separado en SecureStore. */
let state: SessionState = { mode: null, tokens: null, user: null, endReason: null };
let sessionGeneration = 0;
const listeners = new Set<() => void>();
let invalidateTransport: () => void = () => {};

/** La composición conecta el transporte; el estado no conoce HTTP. */
export function configureAuthSession(invalidate: () => void): void {
  invalidateTransport = invalidate;
}

function publish(next: SessionState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

/**
 * Iniciar o terminar una sesión invalida las solicitudes HTTP anteriores.
 * Cambiar tokens durante un refresh NO inicia una sesión nueva.
 */
function replaceSession(next: SessionState): void {
  invalidateTransport();
  sessionGeneration += 1;
  publish(next);
}

export const authSession = {
  // Referencia estable hasta el siguiente cambio: compatible con useSyncExternalStore.
  snapshot: () => state,

  // Permite descartar respuestas que pertenezcan a una cuenta o sesión anterior.
  generation: () => sessionGeneration,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  mode: () => state.mode,
  tokens: () => state.tokens,
  user: () => state.user,

  // Solo se exponen tokens de una sesión autenticada contra el backend.
  accessToken: () =>
    state.mode === "backend" ? (state.tokens?.accessToken ?? null) : null,
  refreshToken: () =>
    state.mode === "backend" ? (state.tokens?.refreshToken ?? null) : null,

  startBackend(
    tokens: AuthTokensResponse,
    user: CurrentUserResponse | null = null,
  ): void {
    replaceSession({ mode: "backend", tokens, user, endReason: null });
  },


  /** El refresh conserva el usuario y el número de generación de su sesión. */
  updateTokens(tokens: AuthTokensResponse): void {
    if (state.mode !== "backend") return;
    publish({ ...state, tokens });
  },

  /** Alias para conservar compatibilidad con el nombre usado en Cristian. */
  rotateBackendTokens(tokens: AuthTokensResponse): void {
    if (state.mode !== "backend") return;
    publish({ ...state, tokens });
  },

  setUser(user: CurrentUserResponse | null): void {
    if (!state.mode) return;
    publish({ ...state, user });
  },

  clear(endReason: SessionEndReason = null): void {
    replaceSession({ mode: null, tokens: null, user: null, endReason });
  },
};


