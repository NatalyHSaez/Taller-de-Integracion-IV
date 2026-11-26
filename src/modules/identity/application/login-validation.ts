import type { CurrentUserResponse } from '../../../core/infrastructure/http/dto';
import { ApiError, normalizeApiError } from '../../../core/infrastructure/http/errors';

export function validateLoginUser(value: unknown): asserts value is CurrentUserResponse {
  const user = value as Partial<CurrentUserResponse> | null;
  if (!user || typeof user.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) ||
      typeof user.fullName !== 'string' || !user.fullName.trim() ||
      typeof user.email !== 'string' || !Array.isArray(user.roles) ||
      !user.roles.length || user.roles.some(role => !['PATIENT', 'CAREGIVER', 'DOCTOR', 'ADMIN'].includes(role))) {
    throw new ApiError({ code: 'INVALID_API_RESPONSE', message: 'El servidor devolvió un perfil inválido. Intenta nuevamente más tarde.' });
  }
}

export function loginErrorMessage(cause: unknown): string {
  const error = normalizeApiError(cause);
  if (error.status === 401) return 'Correo o contraseña incorrectos. Revisa tus datos.';
  if (error.status === 403) return 'Tu cuenta no tiene permitido iniciar sesión. Contacta al equipo de soporte.';
  if (error.status === 422) return 'Revisa el formato del correo y los datos de acceso.';
  if (error.status !== undefined && error.status >= 500) return 'El servicio de acceso no está disponible. Intenta nuevamente más tarde.';
  return error.message;
}
