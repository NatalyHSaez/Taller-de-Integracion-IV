import { configureAuthSession, authSession } from '../../src/core/application/session/auth-session';
import { configureIdentity } from '../../src/modules/identity/application/ports/identity-port';
import { clearLocalSession } from '../../src/modules/identity/application/use-cases/auth-service';
import { login, register, getPatient, getMe, updateMe, validateUserResponse } from '../../src/modules/identity/infrastructure/api/identity-api';
import { IS_API_CONFIGURED } from '../../src/core/infrastructure/config/api-config';
import { apiClient, apiSessionRevision, invalidateApiSession, refreshAccessToken, setApiAccessTokenProvider, setApiSessionHandlers } from '../../src/core/infrastructure/http/api-client';
import { dataClient } from '../../src/core/infrastructure/http/data';
import { clearTokens, getAccessToken, getRefreshToken } from '../../src/core/infrastructure/storage/token-storage';

configureIdentity({
  isConfigured: () => IS_API_CONFIGURED,
  revision: apiSessionRevision,
  login, register, getPatient,
  getMe: async retry => retry ? validateUserResponse(await dataClient.get<unknown>('/me', {
    cache: false, retry: { attempts: 2, initialDelayMs: 300, maxDelayMs: 600 },
  })) : getMe(),
  updateMe,
  revoke: token => apiClient.post<void>('/auth/logout', { refreshToken: token }, { auth: false, timeoutMs: 7_000 }),
  refresh: () => refreshAccessToken(),
  clearCache: () => dataClient.clearCache(),
  clearTokens, getAccessToken, getRefreshToken,
});
configureAuthSession(invalidateApiSession);
setApiAccessTokenProvider(() => authSession.accessToken());
setApiSessionHandlers({ refreshed: tokens => authSession.updateTokens(tokens), expired: clearLocalSession });
