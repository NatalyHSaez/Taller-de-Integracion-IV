import { IS_API_CONFIGURED } from "@/config/api";
import type { AuthTokensResponse, CurrentUserResponse } from "@/types/api";

import { apiClient, login as apiLogin, getMe } from "./api";
import { authSession } from "./auth-session";
import { dataClient } from "./data";
import { demo } from "./demo-store";
import { ApiError } from "./errors";
import { findMockAccount, isMockAccountEmail } from "./mocks/auth-mock";
import { clearTokens, saveTokens } from "./token-storage";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * La aplicación móvil actualmente soporta
 * pacientes y cuidadores.
 */
function ensureMobileRole(user: CurrentUserResponse): void {
  if (user.roles.includes("paciente") || user.roles.includes("cuidador")) {
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
    nombre_completo: account.name,
    correo: account.email,
    roles: [account.role === "patient" ? "paciente" : "cuidador"],
  };
}

function createRuntimeMockTokens(userId: string): AuthTokensResponse {
  return {
    access_token: `mock-access-token-${userId}`,
    refresh_token: `mock-refresh-token-${userId}`,
    token_type: "bearer",
    expires_in: 900,
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
  await clearTokens();

  authSession.clear();
  demo.logout();

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
  const tokens = await apiLogin(normalizeEmail(email), password);

  /*
   * También mantenemos la representación
   * en memoria para AppState y apiClient.
   */
  authSession.startBackend(tokens);

  try {
    /*
     * /me utiliza el access token
     * recientemente recibido.
     */
    const user = await getMe();

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
    await revokeBackendSession(tokens.refresh_token);

    await clearTokens();

    authSession.clear();
    demo.logout();
    dataClient.clearCache();

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
   * Decide automáticamente qué sistema de
   * autenticación utilizar.
   *
   * Cuenta mock conocida
   *      ↓
   * demo-store
   *
   * Otro correo + API configurada
   *      ↓
   * API Gateway
   */
  async login(email: string, password: string): Promise<AuthTokensResponse> {
    // Con Gateway configurado, incluso las cuentas demo se validan en PostgreSQL.
    if (IS_API_CONFIGURED) {
      return loginWithBackend(email, password);
    }

    // Sin Gateway, conservamos el modo demostración local.
    return loginWithMock(email, password);
  },

  /**
   * Obtiene el usuario actualmente autenticado.
   */
  async me(): Promise<CurrentUserResponse> {
    if (authSession.mode() === "backend") {
      const user = await getMe();

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
    if (authSession.mode() !== "backend") {
      throw new ApiError({
        code: "FLOW_NOT_AVAILABLE",
        message: "La renovación real solo aplica a una sesión del backend.",
        details: {},
        status: 409,
      });
    }

    const refreshToken = authSession.refreshToken();

    if (!refreshToken) {
      throw new ApiError({
        code: "AUTHENTICATION_REQUIRED",
        message: "No existe un refresh token disponible.",
        details: {},
        status: 401,
      });
    }

    const raw = await apiClient.post<{
      accessToken: string;
      refreshToken: string;
      tokenType?: string;
      expiresIn?: number;
    }>("/auth/refresh", { refreshToken }, { auth: false });

    if (!raw?.accessToken || !raw?.refreshToken) {
      throw new ApiError({
        code: "INVALID_API_RESPONSE",
        message: "El backend devolvió tokens de renovación inválidos.",
        details: {},
      });
    }

    const tokens: AuthTokensResponse = {
      access_token: raw.accessToken,
      refresh_token: raw.refreshToken,
      token_type: raw.tokenType ?? "bearer",
      expires_in: raw.expiresIn ?? 3600,
    };

    await saveTokens(tokens.access_token, tokens.refresh_token);

    authSession.startBackend(tokens);

    const user = await getMe();

    ensureMobileRole(user);

    authSession.setUser(user);
    demo.startBackendSession(user);

    return tokens;
  },

  /**
   * Cierra correctamente tanto una sesión real
   * como una sesión mock.
   */
  async logout(): Promise<void> {
    const mode = authSession.mode();

    const refreshToken = authSession.refreshToken();

    if (mode === "backend") {
      await revokeBackendSession(refreshToken);
    }

    /*
     * SecureStore siempre se limpia.
     */
    await clearTokens();

    demo.logout();
    authSession.clear();
    dataClient.clearCache();
  },

  /**
   * El cuidador continúa pudiendo registrarse
   * localmente para los flujos mock.
   *
   * El formulario de Sebastián utiliza
   * directamente services/api.ts para el
   * registro real de paciente.
   */
  async register(data: { name: string; email: string; password: string }) {
    demo.registerCaregiver(
      data.name,
      normalizeEmail(data.email),
      data.password,
    );

    /*
     * account-form vuelve al login después
     * del registro, así que no dejamos la
     * cuenta iniciada automáticamente.
     */
    demo.logout();
  },

  async getPatients() {
    return demo.patients();
  },
};
