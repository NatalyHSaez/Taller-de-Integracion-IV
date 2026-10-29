import type { ISODate, UUID, UserRole } from './common';
/** POST /api/v1/auth/login. */
export type LoginRequest = { email: string; password: string };
/** POST /api/v1/auth/refresh y /auth/logout. */
export type RefreshTokenRequest = { refreshToken: string };
/** POST /api/v1/auth/register. PATIENT requiere birthDate (validación del servidor). */
export type RegisterRequest = {
  fullName: string;
  email: string;
  password: string;
  role: Exclude<UserRole, 'ADMIN'>;
  birthDate?: ISODate;
  rut?: string;
  profession?: string;
};
export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
};
/** GET/PATCH /api/v1/me y respuesta del registro. */
export type CurrentUserResponse = {
  id: UUID;
  fullName: string;
  email: string;
  roles: UserRole[];
};
export type UpdateMeRequest = { fullName?: string };
