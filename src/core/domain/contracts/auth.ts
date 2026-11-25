import type { UUID, UserRole } from './common';

/** Respuesta real de POST /api/v1/auth/login y /auth/refresh. */
export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
};

/**
 * Respuesta real de:
 * - POST /api/v1/auth/register
 * - GET/PATCH /api/v1/me
 */
export type CurrentUserResponse = {
  id: UUID;
  fullName: string;
  email: string;
  roles: UserRole[];
};
