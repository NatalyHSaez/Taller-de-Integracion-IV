import type { CurrentUserResponse, UpdateMeRequest } from '@/types/api';
import { apiClient } from './api';
import { authSession } from './auth-session';
import { dataClient } from './data';
import { demo } from './demo-store';
import { ApiError, normalizeApiError } from './errors';
import { validateLoginUser } from './login-validation';

export function buildProfileUpdate(name: string): UpdateMeRequest {
  const fullName = name.trim();
  if (Array.from(fullName).length < 3 || Array.from(fullName).length > 200) {
    throw new Error('El nombre debe tener entre 3 y 200 caracteres.');
  }
  return { fullName };
}

export async function updateMyProfile(name: string): Promise<CurrentUserResponse> {
  const previous = authSession.user();
  if (authSession.mode() !== 'backend' || !previous) {
    throw new ApiError({ code: 'AUTHENTICATION_REQUIRED', status: 401, message: 'Inicia sesión nuevamente para editar tu perfil.' });
  }
  const user = await apiClient.patch<CurrentUserResponse>('/me', buildProfileUpdate(name));
  validateLoginUser(user);
  if (user.id !== previous.id) {
    throw new ApiError({ code: 'INVALID_API_RESPONSE', message: 'El servidor no confirmó tu perfil. Vuelve a consultar tus datos.' });
  }
  // Una respuesta tardía no debe abrir ni modificar otra sesión.
  if (authSession.mode() !== 'backend' || authSession.user() !== previous) {
    throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesión cambió. Inicia sesión y revisa tu perfil.' });
  }
  dataClient.clearCache();
  demo.syncBackendIdentity(user);
  authSession.setUser(user);
  return user;
}

export function profileErrorMessage(cause: unknown): string {
  const error = normalizeApiError(cause);
  if (error.status === 401) return 'Tu sesión venció. Vuelve a iniciar sesión para editar tu perfil.';
  if (error.status === 403) return 'No tienes permiso para modificar este perfil.';
  if (error.status === 422) return 'El servidor rechazó el nombre. Usa entre 3 y 200 caracteres.';
  if (error.code === 'NETWORK_ERROR' || error.code === 'REQUEST_TIMEOUT' || error.code === 'INVALID_API_RESPONSE' || (error.status ?? 0) >= 500) {
    return 'No pudimos confirmar el cambio. Revisa tu perfil al volver a ingresar antes de intentarlo otra vez.';
  }
  return error.message;
}
