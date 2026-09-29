import type { AuthTokensResponse, CurrentUserResponse } from '../../types/api';
import { ApiError } from '../errors';
import {
  MOCK_ACCOUNTS,
  MOCK_AUTH_TOKENS,
  type MockAccount,
} from './api-data';

let currentAccount: MockAccount | null = null;

/** Busca una cuenta ficticia usando las credenciales escritas en el login. */
export function findMockAccount(email: string, password: string): MockAccount | undefined {
  const normalizedEmail = email.trim().toLowerCase();

  return MOCK_ACCOUNTS.find(
    (account) =>
      account.email.toLowerCase() === normalizedEmail &&
      account.password === password,
  );
}

/**
 * Simula POST /api/v1/auth/login.
 * Cuando exista el backend real, esta validación local se reemplazará por HTTP.
 */
export async function mockLogin(
  email: string,
  password: string,
): Promise<AuthTokensResponse> {
  const account = findMockAccount(email, password);

  if (!account) {
    throw new ApiError({
      code: 'INVALID_CREDENTIALS',
      message: 'Correo o contraseña incorrectos.',
      details: {},
      status: 401,
    });
  }

  currentAccount = account;

  return {
    ...MOCK_AUTH_TOKENS,
    accessToken: `${MOCK_AUTH_TOKENS.accessToken}-${account.userId}`,
    refreshToken: `${MOCK_AUTH_TOKENS.refreshToken}-${account.userId}`,
  };
}

/** Simula GET /api/v1/me para la cuenta que inició sesión. */
export async function mockMe(): Promise<CurrentUserResponse> {
  if (!currentAccount) {
    throw new ApiError({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'No existe una sesión mock activa.',
      details: {},
      status: 401,
    });
  }

  return {
    userId: currentAccount.userId,
    email: currentAccount.email,
    firstName: currentAccount.firstName,
    lastName: currentAccount.lastName,
    status: 'ACTIVE',
    roles: [currentAccount.role],
  };
}

export function getCurrentMockAccount(): MockAccount | null {
  return currentAccount;
}

export function mockLogout(): void {
  currentAccount = null;
}
