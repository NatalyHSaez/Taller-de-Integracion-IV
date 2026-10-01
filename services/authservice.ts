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

async function loginWithMock(email: string, password: string): Promise<AuthTokensResponse> {
  dataClient.clearCache();

  const account = findMockAccount(email, password);

  if (account?.role === 'DOCTOR') {
    throw new ApiError({
      code: 'FLOW_NOT_AVAILABLE',
      message: 'El acceso médico se probará desde el flujo profesional.',
      details: { role: 'DOCTOR' },
      status: 409,
    });
  }

  const tokens = await mockApi.auth.login(email, password);
  const user = await mockApi.auth.me();

  try {
    demo.login(email, password);
    authSession.startMock(tokens, user);
  } catch (error) {
    await mockApi.auth.logout();
    authSession.clear();
    throw error;
  }

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
      correo: email.trim().toLowerCase(),
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
   * Durante el desarrollo se mantienen dos fuentes de autenticación claramente
   * separadas:
   * - si el correo pertenece a MOCK_ACCOUNTS, se usa siempre el login mock;
   * - cualquier otro correo usa el API Gateway cuando está configurado.
   *
   * Así los usuarios mock y los usuarios reales pueden probarse al mismo tiempo
   * aunque Docker y el backend estén funcionando.
   */
  login: async (email: string, password: string) => {
    if (isMockAccountEmail(email)) {
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
      await mockApi.auth.logout();
    }

    demo.logout();
    authSession.clear();
    dataClient.clearCache();
  },

  // Registro y datos de dominio siguen mock por ahora.
  register: async (data: { name: string; email: string; password: string }) =>
    demo.registerCaregiver(data.name, data.email, data.password),

  getPatients: async () => demo.patients(),
};
