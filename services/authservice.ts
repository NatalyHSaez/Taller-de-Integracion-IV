import { IS_API_CONFIGURED } from '@/config/api';
import type { AuthTokensResponse, CurrentUserResponse } from '@/types/api';
import { apiClient } from './api';
import { authSession } from './auth-session';
import { demo } from './demo-store';
import { dataClient } from './data';
import { ApiError } from './errors';
import { mockApi } from './mocks/api-mock';
import { findMockAccount, isMockAccountEmail } from './mocks/auth-mock';

function ensureMobileRole(user: CurrentUserResponse): void {
  if (user.roles.includes('paciente') || user.roles.includes('cuidador')) {
    return;
  }

  throw new ApiError({
    code: 'FLOW_NOT_AVAILABLE',
    message: 'El acceso médico y administrador se prueba desde la aplicación web.',
    details: { roles: user.roles },
    status: 409,
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Las cuentas creadas desde la app viven en demo-store y no forman parte de
 * MOCK_ACCOUNTS. Se consideran cuentas mock de ejecución siempre que tengan
 * contraseña local. Las cuentas proyectadas desde el backend usan password ''
 * y no deben confundirse con una cuenta mock creada por el usuario.
 */
function isRuntimeMockAccountEmail(email: string): boolean {
  const normalizedEmail = normalizeEmail(email);

  return demo
    .snapshot()
    .accounts.some(
      (account) =>
        account.email.toLowerCase() === normalizedEmail && account.password.length > 0,
    );
}

function localAccountToCurrentUser(): CurrentUserResponse {
  const account = demo.user();

  if (!account) {
    throw new ApiError({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'No fue posible iniciar la sesión mock.',
      details: {},
      status: 401,
    });
  }

  return {
    id: account.id,
    nombre_completo: account.name,
    correo: account.email,
    roles: [account.role === 'patient' ? 'paciente' : 'cuidador'],
  };
}

function createRuntimeMockTokens(userId: string): AuthTokensResponse {
  return {
    access_token: `mock-access-token-${userId}`,
    refresh_token: `mock-refresh-token-${userId}`,
    token_type: 'bearer',
    expires_in: 900,
  };
}

async function loginWithMock(email: string, password: string): Promise<AuthTokensResponse> {
  dataClient.clearCache();

  const predefinedAccount = findMockAccount(email, password);

  if (predefinedAccount?.role === 'DOCTOR') {
    throw new ApiError({
      code: 'FLOW_NOT_AVAILABLE',
      message: 'El acceso médico se probará desde el flujo profesional.',
      details: { role: 'DOCTOR' },
      status: 409,
    });
  }

  /*
   * demo.login conoce tanto las cuentas mock iniciales como las cuentas creadas
   * durante la ejecución mediante registerCaregiver/activate.
   */
  demo.login(email, password);

  const user = localAccountToCurrentUser();
  const tokens = createRuntimeMockTokens(user.id);
  authSession.startMock(tokens, user);

  return tokens;
}

async function revokeBackendSession(refreshToken: string | null): Promise<void> {
  if (!refreshToken) return;

  try {
    await apiClient.post<void>(
      '/auth/logout',
      { refresh_token: refreshToken },
      { auth: false },
    );
  } catch {
    // El cierre local debe completarse aunque el backend no esté disponible.
  }
}

async function loginWithBackend(email: string, password: string): Promise<AuthTokensResponse> {
  dataClient.clearCache();

  const tokens = await apiClient.post<AuthTokensResponse>(
    '/auth/login',
    {
      correo: normalizeEmail(email),
      password,
    },
    { auth: false },
  );

  authSession.startBackend(tokens);

  try {
    const user = await dataClient.get<CurrentUserResponse>('/auth/me', {
      cache: false,
      retry: { attempts: 2, initialDelayMs: 300, maxDelayMs: 600 },
    });
    ensureMobileRole(user);

    authSession.setUser(user);

    // La identidad y la sesión ya son reales. Los datos clínicos y relaciones
    // continúan siendo mock hasta que esos endpoints existan.
    demo.startBackendSession(user);

    return tokens;
  } catch (error) {
    await revokeBackendSession(tokens.refresh_token);
    authSession.clear();
    demo.logout();
    throw error;
  }
}

export const authService = {
  /**
   * Durante el desarrollo se mantienen dos fuentes de autenticación:
   * - cuentas mock predefinidas en MOCK_ACCOUNTS;
   * - cuentas mock creadas/activadas desde la propia app en demo-store;
   * - cualquier otro correo usa el API Gateway cuando está configurado.
   *
   * De esta forma una cuenta creada localmente puede cerrar sesión y volver a
   * ingresar aunque el backend esté encendido.
   */
  login: async (email: string, password: string) => {
    if (isMockAccountEmail(email) || isRuntimeMockAccountEmail(email)) {
      return loginWithMock(email, password);
    }

    if (!IS_API_CONFIGURED) {
      return loginWithMock(email, password);
    }

    return loginWithBackend(email, password);
  },

  /** Obtiene /auth/me real cuando la sesión proviene del backend. */
  me: async (): Promise<CurrentUserResponse> => {
    if (authSession.mode() === 'backend') {
      const user = await dataClient.get<CurrentUserResponse>('/auth/me', {
        cache: false,
        retry: { attempts: 2, initialDelayMs: 300, maxDelayMs: 600 },
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

    return mockApi.auth.me();
  },

  /** Rota los tokens usando /auth/refresh cuando la sesión es real. */
  refresh: async (): Promise<AuthTokensResponse> => {
    if (authSession.mode() !== 'backend') {
      throw new ApiError({
        code: 'FLOW_NOT_AVAILABLE',
        message: 'La renovación real solo aplica a una sesión del backend.',
        details: {},
        status: 409,
      });
    }

    const refreshToken = authSession.refreshToken();
    if (!refreshToken) {
      throw new ApiError({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'No existe un refresh token disponible.',
        details: {},
        status: 401,
      });
    }

    const tokens = await apiClient.post<AuthTokensResponse>(
      '/auth/refresh',
      { refresh_token: refreshToken },
      { auth: false },
    );

    authSession.startBackend(tokens);

    const user = await dataClient.get<CurrentUserResponse>('/auth/me', {
      cache: false,
      retry: { attempts: 2, initialDelayMs: 300, maxDelayMs: 600 },
    });
    ensureMobileRole(user);
    authSession.setUser(user);
    demo.startBackendSession(user);

    return tokens;
  },

  logout: async () => {
    const mode = authSession.mode();
    const refreshToken = authSession.refreshToken();

    if (mode === 'backend') {
      await revokeBackendSession(refreshToken);
    } else if (mode === 'mock') {
      // Limpia también cualquier sesión interna del mock predefinido.
      await mockApi.auth.logout();
    }

    demo.logout();
    authSession.clear();
    dataClient.clearCache();
  },

  // El registro continúa siendo local/mock por ahora.
  register: async (data: { name: string; email: string; password: string }) =>
    demo.registerCaregiver(data.name, data.email, data.password),

  getPatients: async () => demo.patients(),
};
