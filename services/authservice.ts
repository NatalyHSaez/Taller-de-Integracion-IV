import { IS_API_CONFIGURED } from "@/config/api";
import type { AuthTokensResponse, CurrentUserResponse } from "@/types/api";

import { apiClient, login as apiLogin } from "./api";
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
    const user = await dataClient.get<CurrentUserResponse>("/me", {
      cache: false,
      retry: {
        attempts: 2,
        initialDelayMs: 300,
        maxDelayMs: 600,
      },
    });

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
    if (isMockAccountEmail(email) || isRuntimeMockAccountEmail(email)) {
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
      const user = await dataClient.get<CurrentUserResponse>("/me", {
        cache: false,
        retry: {
          attempts: 2,
          initialDelayMs: 300,
          maxDelayMs: 600,
        },
      });

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

    const tokens = await apiClient.post<AuthTokensResponse>(
      "/auth/refresh",
      {
        refreshToken,
      },
      {
        auth: false,
      },
    );

    /*
     * A diferencia de tu implementación inicial,
     * ahora también persistimos los tokens
     * renovados mediante SecureStore.
     */
    await saveTokens(tokens.accessToken, tokens.refreshToken);

    authSession.startBackend(tokens);

    const user = await dataClient.get<CurrentUserResponse>("/me", {
      cache: false,
      retry: {
        attempts: 2,
        initialDelayMs: 300,
        maxDelayMs: 600,
      },
    });

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
