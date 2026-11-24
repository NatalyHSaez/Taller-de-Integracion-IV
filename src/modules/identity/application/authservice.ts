import { appState } from "@/src/core/application/session/app-state";
import { authSession } from "@/src/core/application/session/auth-session";
import type {
  AuthTokensResponse,
  CurrentUserResponse,
  RegisterRequest,
} from "@/src/core/domain/contracts";
import {
  ApiError,
  normalizeApiError,
} from "@/src/core/domain/errors";
import { identityDependencies } from "./identity-port";
import { validateLoginUser } from "./login-validation";
import { updateMyProfile } from "./profile";

/** Borra la identidad observable y la caché antes de cualquier cambio de sesión. */
export function clearLocalSession(): void {
  authSession.clear();
  identityDependencies().clearCache();
}

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
  if (identityDependencies().isConfigured()) return;
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
  if (!refreshToken || !identityDependencies().isConfigured()) return;
  try {
    await identityDependencies().revoke(refreshToken);
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
  await identityDependencies().clearTokens();

  // identity-api comprueba la revisión de sesión antes y después de persistir tokens.
  const loginRevision = identityDependencies().revision();
  const tokens = await identityDependencies().login(normalizeEmail(email), password);
  if (loginRevision !== identityDependencies().revision()) {
    await revokeBackendSession(tokens.refreshToken);
    throw new ApiError({
      code: "SESSION_CHANGED",
      message: "La sesión cambió.",
    });
  }

  authSession.startBackend(tokens);
  const revision = identityDependencies().revision();
  try {
    const user = await identityDependencies().getMe(true);
    if (revision !== identityDependencies().revision() || authSession.mode() !== "backend") {
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
    if (revision === identityDependencies().revision()) {
      clearLocalSession();
      await identityDependencies().clearTokens();
      await revokeBackendSession(tokens.refreshToken);
    }
    throw error;
  }
}

let restoration: Promise<void> | null = null;

/** Restaura una sesión real sin reemplazar una sesión que haya iniciado entretanto. */
async function restoreStoredSession(): Promise<void> {
  if (authSession.mode()) return;
  const initialRevision = identityDependencies().revision();
  const [accessToken, refreshToken] = await Promise.all([
    identityDependencies().getAccessToken(),
    identityDependencies().getRefreshToken(),
  ]);
  if (initialRevision !== identityDependencies().revision() || authSession.mode()) return;

  if (!refreshToken) {
    // Si solo queda un access token huérfano, se elimina.
    if (accessToken) await identityDependencies().clearTokens();
    return;
  }
  if (!identityDependencies().isConfigured()) return;

  authSession.startBackend({
    accessToken: accessToken ?? "",
    refreshToken,
    tokenType: "bearer",
    expiresIn: 0,
  });
  const revision = identityDependencies().revision();
  try {
    // El refresh token permite recuperar una sesión aunque falte el access token.
    if (!accessToken) {
      const renewed = await identityDependencies().refresh();
      if (revision !== identityDependencies().revision()) return;
      if (!renewed) {
        throw new ApiError({
          code: "AUTHENTICATION_REQUIRED",
          status: 401,
          message: "No fue posible renovar la sesión almacenada.",
        });
      }
    }

    const user = await identityDependencies().getMe(false);
    if (revision !== identityDependencies().revision() || authSession.mode() !== "backend")
      return;
    ensureMobileRole(user);
    authSession.setUser(user);
  } catch (cause) {
    if (revision === identityDependencies().revision()) {
      const error = normalizeApiError(cause);
      clearLocalSession();
      const invalidSession =
        error.status === 401 ||
        error.status === 403 ||
        error.code === "FLOW_NOT_AVAILABLE" ||
        error.code === "INVALID_API_RESPONSE";
      if (invalidSession) await identityDependencies().clearTokens();
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
      const revision = identityDependencies().revision();
      const user = await identityDependencies().getMe(true);
      if (
        revision !== identityDependencies().revision() ||
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
    const access = await identityDependencies().refresh();
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
    await Promise.all([identityDependencies().clearTokens(), revokeBackendSession(token)]);
  },

  async register(data: RegisterRequest): Promise<CurrentUserResponse> {
    requireGateway();
    return identityDependencies().register(data);
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
