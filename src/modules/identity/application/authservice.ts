import { IS_API_CONFIGURED } from "@/src/core/infrastructure/config/api-config";
import type { AuthTokensResponse, CurrentUserResponse, RegisterRequest } from "@/src/core/infrastructure/http/dto";

import { apiClient, refreshAccessToken, setApiSessionHandlers, apiSessionRevision } from "../../../core/infrastructure/http/api-client";
import { login as apiLogin, register as apiRegister } from "../infrastructure/identity-api";
import { authSession } from "../../../core/application/session/auth-session";
import { dataClient } from "../../../core/infrastructure/http/data";
import { demo } from "../../demo/infrastructure/demo-store";
import { ApiError } from "../../../core/infrastructure/http/errors";
import { validateLoginUser } from './login-validation';
import { findMockAccount, isMockAccountEmail } from "../../demo/infrastructure/mocks/auth-mock";
import { clearTokens, getAccessToken, getRefreshToken } from "../../../core/infrastructure/storage/token-storage";

function clearLocalSession() {
  authSession.clear();
  demo.logout();
  dataClient.clearCache();
}
setApiSessionHandlers({ refreshed: tokens => authSession.updateTokens(tokens), expired: clearLocalSession });
let restoration: Promise<void> | null = null;

async function restoreStoredSession() {
  const revision = apiSessionRevision();
  const [accessToken, refreshToken] = await Promise.all([getAccessToken(), getRefreshToken()]);
  if (revision !== apiSessionRevision()) return;
  if (!accessToken || !refreshToken) {
    clearLocalSession();
    await clearTokens();
    return;
  }
  authSession.startBackend({ accessToken, refreshToken, tokenType: 'bearer', expiresIn: 0 });
  const activeRevision = apiSessionRevision();
  try {
    const user = await apiClient.get<CurrentUserResponse>('/me');
    if (activeRevision !== apiSessionRevision()) return;
    ensureMobileRole(user);
    authSession.setUser(user);
    demo.startBackendSession(user);
  } catch (error) {
    if (activeRevision === apiSessionRevision()) {
      clearLocalSession();
      // Una caida de red no invalida los tokens persistidos.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.code === 'FLOW_NOT_AVAILABLE' || error.code === 'INVALID_API_RESPONSE')) await clearTokens();
    }
    throw error;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * La aplicación móvil actualmente soporta
 * pacientes y cuidadores.
 */
function ensureMobileRole(user: CurrentUserResponse): void {
  validateLoginUser(user);
  if (user.roles.includes("PATIENT") || user.roles.includes("CAREGIVER")) {
    return;
  }

  throw new ApiError({
    code: "FLOW_NOT_AVAILABLE",
    message:
      "El acceso médico y administrador se prueba desde la aplicación web.",
    details: {
      roles: user.roles,
    },
    status: 409,
  });
}

/**
 * Además de las cuentas mock originales,
 * demo-store puede contener cuentas creadas
 * durante la ejecución de la aplicación.
 *
 * Las cuentas provenientes del backend usan
 * password vacío, por lo que no se consideran
 * cuentas mock locales.
 */
function isRuntimeMockAccountEmail(email: string): boolean {
  const normalizedEmail = normalizeEmail(email);

  return demo
    .snapshot()
    .accounts.some(
      (account) =>
        account.email.toLowerCase() === normalizedEmail &&
        account.password.length > 0,
    );
}

function localAccountToCurrentUser(): CurrentUserResponse {
  const account = demo.user();

  if (!account) {
    throw new ApiError({
      code: "AUTHENTICATION_REQUIRED",
      message: "No fue posible iniciar la sesión mock.",
      details: {},
      status: 401,
    });
  }

  return {
    id: account.id,
    fullName: account.name,
    email: account.email,
    roles: [account.role === "patient" ? "PATIENT" : "CAREGIVER"],
  };
}

function createRuntimeMockTokens(userId: string): AuthTokensResponse {
  return {
    accessToken: `mock-access-token-${userId}`,
    refreshToken: `mock-refresh-token-${userId}`,
    tokenType: "bearer",
    expiresIn: 900,
  };
}

/**
 * Login utilizando las cuentas locales/mock.
 *
 * No se guardan estos tokens ficticios en
 * SecureStore porque solamente se utilizan
 * para desarrollo.
 */
async function loginWithMock(
  email: string,
  password: string,
): Promise<AuthTokensResponse> {
  dataClient.clearCache();

  /*
   * Si anteriormente existía una sesión real,
   * eliminamos sus tokens persistidos.
   */
  clearLocalSession();
  const revision = apiSessionRevision();
  await clearTokens();
  if (revision !== apiSessionRevision()) throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesión cambió.' });

  const predefinedAccount = findMockAccount(email, password);

  /*
   * Un médico mock no debe entrar al flujo
   * móvil de paciente/cuidador.
   */
  if (predefinedAccount?.role === "DOCTOR") {
    throw new ApiError({
      code: "FLOW_NOT_AVAILABLE",
      message: "El acceso médico se probará desde el flujo profesional.",
      details: {
        role: "DOCTOR",
      },
      status: 409,
    });
  }

  /*
   * demo.login conoce tanto las cuentas
   * iniciales como aquellas creadas localmente.
   */
  demo.login(normalizeEmail(email), password);

  const user = localAccountToCurrentUser();

  const tokens = createRuntimeMockTokens(user.id);

  authSession.startMock(tokens, user);

  return tokens;
}

/**
 * Intenta cerrar una sesión real en el backend.
 *
 * Aunque falle la llamada, posteriormente
 * eliminaremos la sesión local igualmente.
 */
async function revokeBackendSession(
  refreshToken: string | null,
): Promise<void> {
  if (!refreshToken) {
    return;
  }

  try {
    await apiClient.post<void>(
      "/auth/logout",
      {
        refreshToken,
      },
      {
        auth: false,
      },
    );
  } catch {
    /*
     * El logout local debe completarse aunque
     * el backend no esté disponible.
     */
  }
}

/**
 * Login contra el API Gateway real.
 */
async function loginWithBackend(
  email: string,
  password: string,
): Promise<AuthTokensResponse> {
  dataClient.clearCache();

  authSession.clear();
  demo.logout();

  /*
   * Evita reutilizar tokens de una sesión
   * anterior.
   */
  await clearTokens();

  /*
   * apiLogin realiza:
   *
   * POST /api/v1/auth/login
   *
   * y además guarda access + refresh token
   * mediante SecureStore.
   */
  const loginRevision = apiSessionRevision();
  const tokens = await apiLogin(normalizeEmail(email), password);
  if (loginRevision !== apiSessionRevision()) {
    await revokeBackendSession(tokens.refreshToken);
    throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesión cambió.' });
  }

  /*
   * También mantenemos la representación
   * en memoria para AppState y apiClient.
   */
  authSession.startBackend(tokens);
  const revision = apiSessionRevision();

  try {
    /*
     * /me utiliza el access token
     * recientemente recibido.
     */
    const user = await dataClient.get<CurrentUserResponse>("/me", {
      cache: false,
      retry: {
        attempts: 2,
        initialDelayMs: 300,
        maxDelayMs: 600,
      },
    });

    if (revision !== apiSessionRevision()) throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesion cambio.' });
    ensureMobileRole(user);

    authSession.setUser(user);

    /*
     * Mientras pacientes, relaciones,
     * mediciones, etc. sigan utilizando mocks,
     * proyectamos la identidad real sobre
     * demo-store.
     */
    demo.startBackendSession(user);

    return tokens;
  } catch (error) {
    await revokeBackendSession(tokens.refreshToken);

    if (revision === apiSessionRevision()) {
      clearLocalSession();
      await clearTokens();
    }

    throw error;
  }
}

export const authService = {
  /**
   * Permite saber si un correo corresponde
   * a una cuenta local/mock.
   *
   * Se conserva por compatibilidad con código
   * desarrollado por Sebastián.
   */
  hasLocalAccount(email: string): boolean {
    return isMockAccountEmail(email) || isRuntimeMockAccountEmail(email);
  },

  /**
   * Usa el backend por defecto. Las cuentas de demostración requieren
   * seleccionar explícitamente el modo mock, aunque coincida el correo.
   */
  async login(email: string, password: string, mode: 'backend' | 'mock' = 'backend'): Promise<AuthTokensResponse> {
    if (mode === 'mock') {
      return loginWithMock(email, password);
    }

    /*
     * Las cuentas mock conocidas continúan disponibles para desarrollo, pero
     * una cuenta real nunca debe caer silenciosamente al flujo simulado.
     */
    if (!IS_API_CONFIGURED) {
      throw new ApiError({
        code: "API_NOT_CONFIGURED",
        message: "La URL del API Gateway no está configurada.",
        details: {
          variable: "EXPO_PUBLIC_API_URL",
        },
      });
    }

    return loginWithBackend(email, password);
  },

  /**
   * Obtiene el usuario actualmente autenticado.
   */
  async me(): Promise<CurrentUserResponse> {
    if (authSession.mode() === "backend") {
      const revision = apiSessionRevision();
      const user = await dataClient.get<CurrentUserResponse>("/me", {
        cache: false,
        retry: {
          attempts: 2,
          initialDelayMs: 300,
          maxDelayMs: 600,
        },
      });

      if (revision !== apiSessionRevision()) throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesion cambio.' });
      ensureMobileRole(user);

      authSession.setUser(user);
      demo.startBackendSession(user);

      return user;
    }

    const mockUser = authSession.user();

    if (mockUser) {
      return mockUser;
    }

    /*
     * Respaldo para una cuenta que actualmente
     * esté activa en demo-store.
     */
    return localAccountToCurrentUser();
  },

  /**
   * Renueva explícitamente los tokens de una
   * sesión real.
   */
  async refresh(): Promise<AuthTokensResponse> {
    if (authSession.mode() !== 'backend') throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401, message: 'Inicia sesion nuevamente.' });
    const access = await refreshAccessToken();
    const tokens = authSession.tokens();
    if (!access || !tokens) throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401, message: 'La sesion vencio.' });
    return tokens;
  },

  restore(): Promise<void> {
    if (!restoration) {
      restoration = restoreStoredSession().finally(() => { restoration = null; });
    }
    return restoration;
  },

  /**
   * Cierra correctamente tanto una sesión real
   * como una sesión mock.
   */
  async logout(): Promise<void> {
    const refreshToken = authSession.refreshToken();
    clearLocalSession();
    // Borrar primero: el usuario sale incluso si el servidor no responde.
    await Promise.all([clearTokens(), revokeBackendSession(refreshToken)]);
  },

  /** Registro real; crear una cuenta no abre ni reemplaza una sesión. */
  async register(data: RegisterRequest): Promise<CurrentUserResponse> {
    return apiRegister(data);
  },

  async getPatients() {
    return demo.patients();
  },
};
