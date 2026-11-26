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
  /** Estado de verificación profesional; null para cuentas sin perfil médico. */
  doctorStatus?: string | null;
};

/** Validación de respuestas externas; no se aplica a tokens parciales de restauración local. */
export function isAuthTokensResponse(value: unknown): value is AuthTokensResponse {
  const t = value as Partial<AuthTokensResponse> | null;
  return !!t && typeof t.accessToken === 'string' && !!t.accessToken.trim() &&
    typeof t.refreshToken === 'string' && !!t.refreshToken.trim() &&
    typeof t.tokenType === 'string' && t.tokenType.toLowerCase() === 'bearer' &&
    typeof t.expiresIn === 'number' && Number.isSafeInteger(t.expiresIn) && t.expiresIn > 0;
}

export function isCurrentUserResponse(value: unknown): value is CurrentUserResponse {
  const u = value as Partial<CurrentUserResponse> | null;
  return !!u && typeof u.id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u.id) &&
    typeof u.fullName === 'string' && !!u.fullName.trim() &&
    typeof u.email === 'string' && /^[^\s@]+@[^\s@]+$/.test(u.email) &&
    Array.isArray(u.roles) && u.roles.length > 0 &&
    u.roles.every(role => ['PATIENT', 'CAREGIVER', 'DOCTOR', 'ADMIN'].includes(role)) &&
    (u.doctorStatus === undefined || u.doctorStatus === null ||
      (typeof u.doctorStatus === 'string' && !!u.doctorStatus.trim()));
}
