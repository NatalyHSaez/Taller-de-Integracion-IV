/**
 * Endpoints del microservicio de identidad (a través del API Gateway):
 *   POST /auth/register, POST /auth/login, GET /me, GET /patients/{patientId}
 */
import { isAuthTokensResponse, isCurrentUserResponse, type AuthTokensResponse, type CurrentUserResponse } from "@/src/core/domain/contracts/auth";
import type { RegisterRequest, UpdateMeRequest } from "@/src/modules/identity/domain/account-requests";
import {
  apiClient,
  apiSessionRevision,
} from "@/src/core/infrastructure/http/api-client";
import { ApiError } from "@/src/core/infrastructure/http/errors";
import { saveTokens } from "@/src/core/infrastructure/storage/token-storage";

/** Registro real a través del Gateway. */
export async function register(data: RegisterRequest): Promise<CurrentUserResponse> {
  const user = await apiClient.post<CurrentUserResponse>(
    "/auth/register",

    {
      ...data,

      fullName: data.fullName.trim(),

      email: data.email.trim().toLowerCase(),
    },

    {
      auth: false,
    },
  );
  if (!isCurrentUserResponse(user) || !user.roles.includes(data.role)) {
    throw new ApiError({
      code: 'INVALID_API_RESPONSE',
      message: 'El servidor no confirmó correctamente la cuenta. Intenta iniciar sesión antes de registrarte nuevamente.',
    });
  }
  return user;
}

/*
 * Login real.
 *
 * Además de retornar los tokens, los guarda
 * mediante SecureStore.
 */
export async function login(
  email: string,
  password: string,
): Promise<AuthTokensResponse> {
  const revision = apiSessionRevision();
  const tokens = await apiClient.post<AuthTokensResponse>(
    "/auth/login",

    {
      email: email.trim().toLowerCase(),

      password,
    },

    {
      auth: false,
    },
  );

  if (!isAuthTokensResponse(tokens)) {
    throw new ApiError({
      code: "INVALID_API_RESPONSE",

      message: "El servidor devolvió una sesión inválida.",

      details: {},
    });
  }

  if (revision !== apiSessionRevision()) {
    await apiClient.post('/auth/logout', { refreshToken: tokens.refreshToken }, { auth: false }).catch(() => {});
    throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesion cambio.' });
  }
  await saveTokens(tokens.accessToken, tokens.refreshToken);
  if (revision !== apiSessionRevision()) {
    await apiClient.post('/auth/logout', { refreshToken: tokens.refreshToken }, { auth: false }).catch(() => {});
    throw new ApiError({ code: 'SESSION_CHANGED', message: 'La sesion cambio.' });
  }


  return tokens;
}

/*
 * Usuario real autenticado.
 */
export async function getMe(): Promise<CurrentUserResponse> {
  return validateUserResponse(await apiClient.get<unknown>("/me"));
}

export type { PatientProfileResponse } from '../../domain/patient-profile';
import { isPatientProfileResponse, type PatientProfileResponse } from '../../domain/patient-profile';

export async function getPatient(
  patientId: string,
): Promise<PatientProfileResponse> {
  const profile = await apiClient.get<unknown>(
    `/patients/${encodeURIComponent(patientId)}`,
  );
  if (!isPatientProfileResponse(profile)) {
    throw new ApiError({ code: 'INVALID_API_RESPONSE', message: 'El servidor devolvió una ficha incompleta o inválida.' });
  }
  if (profile.id !== patientId) {
    throw new ApiError({ code: 'PATIENT_NOT_FOUND', status: 404, message: 'La ficha solicitada no está disponible.' });
  }
  return profile;
}

/** Valida las respuestas de identidad, incluyendo la consulta con reintento. */
export function validateUserResponse(value: unknown): CurrentUserResponse {
  if (!isCurrentUserResponse(value)) {
    throw new ApiError({ code: 'INVALID_API_RESPONSE', message: 'El servidor devolvió un perfil inválido. Intenta nuevamente más tarde.' });
  }
  return value;
}

export async function updateMe(data: UpdateMeRequest): Promise<CurrentUserResponse> {
  return validateUserResponse(await apiClient.patch<unknown>('/me', data));
}
