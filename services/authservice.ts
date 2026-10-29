import { IS_API_CONFIGURED } from '@/config/api';
import type { AuthTokensResponse, CurrentUserResponse, RegisterRequest } from '@/types/api';
import { apiClient, login as apiLogin, refreshAccessToken, register as apiRegister } from './api';
import { authSession } from './auth-session';
import { dataClient } from './data';
import { demo } from './demo-store';
import { patientAccess } from './patient-access';
import { ApiError, normalizeApiError } from './errors';
import { findMockAccount } from './mocks/auth-mock';
import { clearTokens, getAccessToken, getRefreshToken } from './token-storage';

function ensureMobileRole(user: CurrentUserResponse): void {
  if (user.roles.includes('PATIENT') || user.roles.includes('CAREGIVER')) return;
  throw new ApiError({
    code: 'FLOW_NOT_AVAILABLE', status: 409,
    message: 'El acceso médico y administrador se realiza desde la aplicación web.',
    details: {},
  });
}

function requireGateway(): void {
  if (IS_API_CONFIGURED) return;
  throw new ApiError({
    code: 'API_NOT_CONFIGURED',
    message: 'Configura EXPO_PUBLIC_API_URL para conectar con el servidor.',
    details: {},
  });
}

function beginCleanSession(): void {
  authSession.clear();
  patientAccess.clear();
  demo.logout();
  dataClient.clearCache();
}

async function loginMock(email: string, password: string): Promise<AuthTokensResponse> {
  const known = findMockAccount(email, password);
  const runtime = demo.snapshot().accounts.find(
    (account) => account.email.toLowerCase() === email.toLowerCase() && account.password === password && password.length > 0,
  );
  if (known?.role === 'DOCTOR') {
    throw new ApiError({ code: 'FLOW_NOT_AVAILABLE', status: 409,
      message: 'El acceso médico solo está disponible en la web.', details: {} });
  }
  if (!known && !runtime) {
    throw new ApiError({ code: 'INVALID_CREDENTIALS', status: 401,
      message: 'Correo o contraseña incorrectos en el modo de demostración.', details: {} });
  }
  beginCleanSession();
  await clearTokens();
  demo.login(email.trim().toLowerCase(), password);
  const account = demo.user();
  if (!account) throw new Error('No se pudo iniciar la sesión de demostración.');
  const user: CurrentUserResponse = {
    id: account.id, fullName: account.name, email: account.email,
    roles: [account.role === 'patient' ? 'PATIENT' : 'CAREGIVER'],
  };
  const tokens: AuthTokensResponse = {
    accessToken: `mock-access-${account.id}`, refreshToken: `mock-refresh-${account.id}`,
    tokenType: 'bearer', expiresIn: 900,
  };
  authSession.startMock(tokens, user);
  return tokens;
}

async function revokeRemote(refreshToken: string | null): Promise<void> {
  if (!refreshToken || !IS_API_CONFIGURED) return;
  try {
    await apiClient.post<void>('/auth/logout', { refreshToken }, { auth: false, timeoutMs: 7_000 });
  } catch {
    // La desconexión no impide el cierre local. El token remoto expirará según backend.
  }
}

let pendingRestore: Promise<CurrentUserResponse | null> | null = null;

export const authService = {
  hasLocalAccount(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    return demo.snapshot().accounts.some((item) => item.email.toLowerCase() === normalized && item.password.length > 0);
  },

  /** El modo real es el predeterminado. El modo demo debe elegirse en la pantalla. */
  async login(email: string, password: string, mode: 'backend' | 'mock' = 'backend'): Promise<AuthTokensResponse> {
    if (mode === 'mock') return loginMock(email, password);
    requireGateway();
    beginCleanSession();
    await clearTokens();
    const tokens = await apiLogin(email, password);
    authSession.startBackend(tokens);
    const generation = authSession.generation();
    try {
      const user = await dataClient.get<CurrentUserResponse>('/me', { cache: false });
      if (authSession.generation() !== generation) {
        throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesión cambió durante el inicio de sesión.', details: {} });
      }
      ensureMobileRole(user);
      authSession.setUser(user);
      // Compatibilidad de presentación: solo identidad real, sin mediciones o relaciones inventadas.
      demo.startBackendSession(user);
      return authSession.tokens() ?? tokens;
    } catch (cause) {
      if (authSession.generation() === generation) {
        await revokeRemote(authSession.refreshToken());
        beginCleanSession();
        await clearTokens();
      }
      throw cause;
    }
  },

  async restore(): Promise<CurrentUserResponse | null> {
    if (pendingRestore) return pendingRestore;
    const action = (async (): Promise<CurrentUserResponse | null> => {
      // No sobrescribir una sesión que ya se inició desde la interfaz.
      if (authSession.mode()) return authSession.user();
      const [accessToken, refreshToken] = await Promise.all([getAccessToken(), getRefreshToken()]);
      if (!refreshToken) {
        if (accessToken) await clearTokens();
        return null;
      }
      if (!IS_API_CONFIGURED) return null;

      authSession.startBackend({ accessToken: accessToken ?? '', refreshToken, tokenType: 'bearer', expiresIn: 0 });
      const generation = authSession.generation();
      try {
        // Si no hay access token, primero renovar. Con uno expirado /me activa el refresh automático.
        if (!accessToken) {
          const renewed = await refreshAccessToken();
          if (!renewed) return null;
        }
        const user = await dataClient.get<CurrentUserResponse>('/me', { cache: false });
        if (authSession.generation() !== generation) return null;
        ensureMobileRole(user);
        authSession.setUser(user);
        demo.startBackendSession(user);
        return user;
      } catch (cause) {
        const error = normalizeApiError(cause);
        if (authSession.generation() === generation) {
          // Sesión inválida: borrar. Fallo transitorio: conservar tokens para reintento futuro.
          if (error.status === 401) {
            beginCleanSession();
            await clearTokens();
          } else {
            authSession.clear();
            patientAccess.clear();
            demo.logout();
            dataClient.clearCache();
          }
        }
        return null;
      }
    })();
    pendingRestore = action;
    try { return await action; }
    finally { if (pendingRestore === action) pendingRestore = null; }
  },
  async me(): Promise<CurrentUserResponse> {
    if (authSession.mode() === 'mock') {
      const mock = authSession.user();
      if (!mock) throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401,
        message: 'No hay sesión de demostración.', details: {} });
      return mock;
    }
    if (authSession.mode() !== 'backend') throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401,
      message: 'Inicia sesión para continuar.', details: {} });
    const generation = authSession.generation();
    const user = await dataClient.get<CurrentUserResponse>('/me', { cache: false });
    if (authSession.generation() !== generation || authSession.mode() !== 'backend') {
      throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesión cambió durante la consulta.', details: {} });
    }
    ensureMobileRole(user);
    authSession.setUser(user);
    demo.startBackendSession(user);
    return user;
  },

  async refresh(): Promise<AuthTokensResponse> {
    if (authSession.mode() !== 'backend') throw new ApiError({
      code: 'AUTHENTICATION_REQUIRED', status: 401, message: 'No hay sesión real activa.', details: {},
    });
    const token = await refreshAccessToken(authSession.accessToken());
    const tokens = authSession.tokens();
    if (!token || !tokens) throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401,
      message: 'No fue posible renovar la sesión.', details: {} });
    return tokens;
  },

  async updateName(fullName: string): Promise<CurrentUserResponse> {
    if (authSession.mode() !== 'backend') throw new ApiError({
      code: 'FLOW_NOT_AVAILABLE', status: 409, message: 'La edición real requiere una sesión del backend.', details: {},
    });
    const generation = authSession.generation();
    const user = await apiClient.patch<CurrentUserResponse>('/me', { fullName: fullName.trim() });
    if (authSession.generation() !== generation || authSession.mode() !== 'backend') {
      throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesión cambió durante la actualización.', details: {} });
    }
    authSession.setUser(user);
    demo.startBackendSession(user);
    return user;
  },

  async register(data: RegisterRequest): Promise<CurrentUserResponse> {
    requireGateway();
    return apiRegister(data) as Promise<CurrentUserResponse>;
  },

  async logout(): Promise<void> {
    const token = authSession.mode() === 'backend' ? authSession.refreshToken() : null;
    // Invalidar primero la memoria; así ninguna respuesta atrasada puede restaurar la sesión.
    beginCleanSession();
    try { await clearTokens(); } finally { await revokeRemote(token); }
  },

  /** P5: listado real para cuidadores, sin fabricar relaciones. */
  async getPatients() {
    if (authSession.mode() === 'mock') return demo.patients();
    if (authSession.mode() === 'backend' && authSession.user()?.roles.includes('CAREGIVER')) {
      return patientAccess.ensureLoaded();
    }
    return [];
  },
};
