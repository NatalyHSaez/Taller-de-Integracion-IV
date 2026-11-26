import type { ISODate, UserRole } from '@/src/core/domain/contracts/common';

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
  rut?: string;
  profession?: string;
} & ({ role: 'PATIENT'; birthDate: ISODate } | {
  role: Exclude<UserRole, 'ADMIN' | 'PATIENT'>;
  birthDate?: ISODate;
});

/** Body real de PATCH /api/v1/me. */
export type UpdateMeRequest = {
  fullName?: string;
};
