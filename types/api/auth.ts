import type { ISODate, UUID, UserRole } from './common';

/** Formato interno compatible con la aplicación móvil. */
export type LoginRequest = {
  correo: string;
  password: string;
};

/** Formato interno para refresh/logout. */
export type RefreshTokenRequest = {
  refresh_token: string;
};

/**
 * Formato interno del registro; api.ts lo adapta al backend nuevo.
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

/** Tokens en formato interno, normalizados por api.ts. */
export type AuthTokensResponse = {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer' | string;
  expires_in: number;
};

/**
 * Usuario en formato interno, normalizado por api.ts.
 */
export type CurrentUserResponse = {
  id: UUID;
  nombre_completo: string;
  correo: string;
  roles: UserRole[];
};
