import { appState } from "@/src/core/application/session/app-state";
import { authSession } from "@/src/core/application/session/auth-session";
import { IS_API_CONFIGURED } from "@/src/core/infrastructure/config/api-config";
import {
  apiClient,
  apiSessionRevision,
  refreshAccessToken,
  setApiSessionHandlers,
} from "@/src/core/infrastructure/http/api-client";
import { dataClient } from "@/src/core/infrastructure/http/data";
import type {
  AuthTokensResponse,
  CurrentUserResponse,
  RegisterRequest,
} from "@/src/core/infrastructure/http/dto";
import {
  ApiError,
  normalizeApiError,
} from "@/src/core/infrastructure/http/errors";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
} from "@/src/core/infrastructure/storage/token-storage";
import {
  login as apiLogin,
  register as apiRegister,
} from "../infrastructure/identity-api";
import { validateLoginUser } from "./login-validation";
import { updateMyProfile } from "./profile";

/** Borra la identidad observable y la caché antes de cualquier cambio de sesión. */
function clearLocalSession(): void {
  authSession.clear();
  dataClient.clearCache();
}

// El refresh HTTP actualiza la única sesión observable; un 401 definitivo la invalida.
setApiSessionHandlers({
  refreshed: (tokens) => authSession.updateTokens(tokens),
  expired: clearLocalSession,
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** La aplicación móvil solo admite pacientes y cuidadores. */
function ensureMobileRole(user: CurrentUserResponse): void {
  validateLoginUser(user);
  if (user.roles.includes("PATIENT") || user.roles.includes("CAREGIVER"))
    return;
  throw new ApiError({
    code: "FLOW_NOT_AVAILABLE",
    status: 409,
    message:
      "El acceso médico y administrador se realiza desde la aplicación web.",
    details: { roles: user.roles },
  });
}

function requireGateway(): void {
  if (IS_API_CONFIGURED) return;
  throw new ApiError({
    code: "API_NOT_CONFIGURED",
    message: "Configura EXPO_PUBLIC_API_URL para conectar con el servidor.",
    details: { variable: "EXPO_PUBLIC_API_URL" },
  });
}

/** Revocación remota best-effort: no impide cerrar la sesión local sin conexión. */
async function revokeBackendSession(
  refreshToken: string | null,
): Promise<void> {
  if (!refreshToken || !IS_API_CONFIGURED) return;
  try {
    await apiClient.post<void>(
      "/auth/logout",
      { refreshToken },
      { auth: false, timeoutMs: 7_000 },
    );
  } catch {
    // El token remoto expirará según las reglas del backend.
  }
}

async function loginWithBackend(
  email: string,
  password: string,
): Promise<AuthTokensResponse> {
  requireGateway();
  clearLocalSession();
  await clearTokens();

  // identity-api comprueba la revisión de sesión antes y después de persistir tokens.
  const loginRevision = apiSessionRevision();
  const tokens = await apiLogin(normalizeEmail(email), password);
  if (loginRevision !== apiSessionRevision()) {
    await revokeBackendSession(tokens.refreshToken);
    throw new ApiError({
      code: "SESSION_CHANGED",
      message: "La sesión cambió.",
    });
  }

  authSession.startBackend(tokens);
  const revision = apiSessionRevision();
  try {
    const user = await dataClient.get<CurrentUserResponse>("/me", {
      cache: false,
      retry: { attempts: 2, initialDelayMs: 300, maxDelayMs: 600 },
    });
    if (revision !== apiSessionRevision() || authSession.mode() !== "backend") {
      throw new ApiError({
        code: "SESSION_CHANGED",
        message: "La sesión cambió.",
      });
    }
    ensureMobileRole(user);
    authSession.setUser(user);
    // Solo proyectar identidad: no fabricar mediciones ni relaciones reales.
    return authSession.tokens() ?? tokens;
  } catch (error) {
    // Evitar que una respuesta atrasada borre otra sesión iniciada después.
    if (revision === apiSessionRevision()) {
      clearLocalSession();
      await clearTokens();
      await revokeBackendSession(tokens.refreshToken);
    }
    throw error;
  }
}

let restoration: Promise<void> | null = null;

/** Restaura una sesión real sin reemplazar una sesión que haya iniciado entretanto. */
async function restoreStoredSession(): Promise<void> {
  if (authSession.mode()) return;
  const initialRevision = apiSessionRevision();
  const [accessToken, refreshToken] = await Promise.all([
    getAccessToken(),
    getRefreshToken(),
  ]);
  if (initialRevision !== apiSessionRevision() || authSession.mode()) return;

  if (!refreshToken) {
    // Si solo queda un access token huérfano, se elimina.
    if (accessToken) await clearTokens();
    return;
  }
  if (!IS_API_CONFIGURED) return;

  authSession.startBackend({
    accessToken: accessToken ?? "",
    refreshToken,
    tokenType: "bearer",
    expiresIn: 0,
  });
  const revision = apiSessionRevision();
  try {
    // El refresh token permite recuperar una sesión aunque falte el access token.
    if (!accessToken) {
      const renewed = await refreshAccessToken();
      if (revision !== apiSessionRevision()) return;
      if (!renewed) {
        throw new ApiError({
          code: "AUTHENTICATION_REQUIRED",
          status: 401,
          message: "No fue posible renovar la sesión almacenada.",
        });
      }
    }

    const user = await apiClient.get<CurrentUserResponse>("/me");
    if (revision !== apiSessionRevision() || authSession.mode() !== "backend")
      return;
    ensureMobileRole(user);
    authSession.setUser(user);
  } catch (cause) {
    if (revision === apiSessionRevision()) {
      const error = normalizeApiError(cause);
      clearLocalSession();
      const invalidSession =
        error.status === 401 ||
        error.status === 403 ||
        error.code === "FLOW_NOT_AVAILABLE" ||
        error.code === "INVALID_API_RESPONSE";
      if (invalidSession) await clearTokens();
      // Un fallo transitorio de red no elimina los tokens persistidos.
    }
    throw cause;
  }
}

export const authService = {
  async login(email: string, password: string): Promise<AuthTokensResponse> {
    return loginWithBackend(email, password);
  },

  async me(): Promise<CurrentUserResponse> {
    if (authSession.mode() === "backend") {
      const revision = apiSessionRevision();
      const user = await dataClient.get<CurrentUserResponse>("/me", {
        cache: false,
        retry: { attempts: 2, initialDelayMs: 300, maxDelayMs: 600 },
      });
      if (
        revision !== apiSessionRevision() ||
        authSession.mode() !== "backend"
      ) {
        throw new ApiError({
          code: "SESSION_CHANGED",
          message: "La sesión cambió.",
        });
      }
      ensureMobileRole(user);
      authSession.setUser(user);
        return user;
    }
    throw new ApiError({
      code: "AUTHENTICATION_REQUIRED",
      status: 401,
      message: "Inicia sesión para continuar.",
    });
  },

  async refresh(): Promise<AuthTokensResponse> {
    if (authSession.mode() !== "backend") {
      throw new ApiError({
        code: "AUTHENTICATION_REQUIRED",
        status: 401,
        message: "No hay una sesión real activa.",
      });
    }
    const access = await refreshAccessToken();
    const tokens = authSession.tokens();
    if (!access || !tokens || authSession.mode() !== "backend") {
      throw new ApiError({
        code: "AUTHENTICATION_REQUIRED",
        status: 401,
        message: "No fue posible renovar la sesión.",
      });
    }
    return tokens;
  },

  restore(): Promise<void> {
    if (!restoration) {
      restoration = restoreStoredSession().finally(() => {
        restoration = null;
      });
    }
    return restoration;
  },

  async logout(): Promise<void> {
    const token =
      authSession.mode() === "backend" ? authSession.refreshToken() : null;
    clearLocalSession();
    // Invalidar memoria primero y borrar tokens incluso cuando el servidor esté caído.
    await Promise.all([clearTokens(), revokeBackendSession(token)]);
  },

  async register(data: RegisterRequest): Promise<CurrentUserResponse> {
    requireGateway();
    return apiRegister(data);
  },

  /** Compatibilidad con la edición de nombre agregada en Cristian. */
  async updateName(fullName: string): Promise<CurrentUserResponse> {
    return updateMyProfile(fullName);
  },

  /** En backend nunca devuelve pacientes simulados. */
  async getPatients() {
    if (authSession.mode() !== "backend") return [];
    if (authSession.user()?.roles.includes("CAREGIVER")) {
      await appState.loadRealPatients();
    }
    return appState.snapshot().patients;
  },
};
