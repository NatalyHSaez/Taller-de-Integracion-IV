import type { ISODate, UUID, UserRole } from './common';

/** Body real de POST /api/v1/auth/login. */
export type LoginRequest = {
  correo: string;
  password: string;
};

/** Body real de POST /api/v1/auth/refresh y /auth/logout. */
export type RefreshTokenRequest = {
  refresh_token: string;
};

/**
 * Body real de POST /api/v1/auth/registro.
 * - paciente exige fecha_nacimiento;
 * - medico puede enviar rut y profesion;
 * - administrador no se registra desde esta ruta.
 */
export type RegisterRequest = {
  nombre_completo: string;
  correo: string;
  password: string;
  rol: Exclude<UserRole, 'administrador'>;
  fecha_nacimiento?: ISODate;
  rut?: string;
  profesion?: string;
};

/** Respuesta real de POST /api/v1/auth/login y /auth/refresh. */
export type AuthTokensResponse = {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer' | string;
  expires_in: number;
};

/**
 * Respuesta real de:
 * - POST /api/v1/auth/registro
 * - GET /api/v1/auth/me
 */
export type CurrentUserResponse = {
  id: UUID;
  nombre_completo: string;
  correo: string;
  roles: UserRole[];
};
