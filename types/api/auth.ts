import type { ISODate, UUID, UserRole } from './common';

/** Body real de POST /api/v1/auth/login. */
export type LoginRequest = {
  email: string;
  password: string;
};

/** Body real de POST /api/v1/auth/refresh y /auth/logout. */
export type RefreshTokenRequest = {
  refreshToken: string;
};

/**
 * Body real de POST /api/v1/auth/register.
 * - PATIENT exige birthDate;
 * - DOCTOR puede enviar rut y profession;
 * - ADMIN no se registra desde esta ruta.
 */
export type RegisterRequest = {
  fullName: string;
  email: string;
  password: string;
  role: Exclude<UserRole, 'ADMIN'>;
  birthDate?: ISODate;
  rut?: string;
  profession?: string;
};

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

/** Body real de PATCH /api/v1/me. */
export type UpdateMeRequest = {
  fullName?: string;
};
