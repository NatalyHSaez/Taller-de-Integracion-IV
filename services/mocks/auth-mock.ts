import type {
  AuthTokensResponse,
  CurrentUserResponse,
  UserRole,
} from '../../types/api';
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

function mockRoleToApiRole(role: MockAccount['role']): UserRole {
  switch (role) {
    case 'PATIENT':
      return 'paciente';
    case 'CAREGIVER':
      return 'cuidador';
    case 'DOCTOR':
      return 'medico';
  }
}

/**
 * Simula POST /api/v1/auth/login utilizando la misma forma de respuesta
 * que el backend real de Integración II.
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
    access_token: `${MOCK_AUTH_TOKENS.access_token}-${account.userId}`,
    refresh_token: `${MOCK_AUTH_TOKENS.refresh_token}-${account.userId}`,
  };
}

/** Simula GET /api/v1/auth/me con el contrato real actual. */
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
    id: currentAccount.userId,
    nombre_completo: `${currentAccount.firstName} ${currentAccount.lastName}`,
    correo: currentAccount.email,
    roles: [mockRoleToApiRole(currentAccount.role)],
  };
}

export function getCurrentMockAccount(): MockAccount | null {
  return currentAccount;
}

export function mockLogout(): void {
  currentAccount = null;
}
