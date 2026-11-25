import { isCurrentUserResponse, type CurrentUserResponse } from '../../../../core/domain/contracts/auth';
import { ApiError, normalizeApiError } from '../../../../core/domain/errors';

export function validateLoginUser(value: unknown): asserts value is CurrentUserResponse {
  if (!isCurrentUserResponse(value)) {
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
