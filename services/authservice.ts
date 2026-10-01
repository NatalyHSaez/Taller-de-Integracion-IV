import { IS_API_CONFIGURED } from '@/config/api';
import type { AuthTokensResponse, CurrentUserResponse } from '@/types/api';
import { apiClient } from './api';
import { authSession } from './auth-session';
import { demo } from './demo-store';
import { ApiError, normalizeApiError } from './errors';
import { mockApi } from './mocks/api-mock';
import { findMockAccount } from './mocks/auth-mock';

const FALLBACK_MOCK_ERRORS = new Set([
  'API_NOT_CONFIGURED',
  'NETWORK_ERROR',
  'REQUEST_TIMEOUT',
  'SERVICE_UNAVAILABLE',
]);

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
    const user = await apiClient.get<CurrentUserResponse>('/auth/me');
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
   * Si EXPO_PUBLIC_API_URL está configurada, la autenticación se realiza contra
   * el API Gateway real. Solo se vuelve al login mock cuando el servidor no puede
   * alcanzarse y las credenciales pertenecen explícitamente a una cuenta mock.
   */
  login: async (email: string, password: string) => {
    if (!IS_API_CONFIGURED) {
      return loginWithMock(email, password);
    }

    try {
      return await loginWithBackend(email, password);
    } catch (error) {
      const normalized = normalizeApiError(error);
      const mockAccount = findMockAccount(email, password);

      if (mockAccount && FALLBACK_MOCK_ERRORS.has(normalized.code)) {
        return loginWithMock(email, password);
      }

      throw error;
    }
  },

  /** Obtiene /auth/me real cuando la sesión proviene del backend. */
  me: async (): Promise<CurrentUserResponse> => {
    if (authSession.mode() === 'backend') {
      const user = await apiClient.get<CurrentUserResponse>('/auth/me');
      authSession.setUser(user);
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

    const user = await apiClient.get<CurrentUserResponse>('/auth/me');
    ensureMobileRole(user);
    authSession.setUser(user);

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

    authSession.clear();
    demo.logout();
  },

  // Registro y datos de dominio siguen mock por ahora.
  register: async (data: { name: string; email: string; password: string }) =>
    demo.registerCaregiver(data.name, data.email, data.password),

  getPatients: async () => demo.patients(),
};
