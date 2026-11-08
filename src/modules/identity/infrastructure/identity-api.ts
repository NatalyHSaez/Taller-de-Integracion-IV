/**
 * Endpoints del microservicio de identidad (a través del API Gateway):
 *   POST /auth/register, POST /auth/login, GET /me, GET /patients/{patientId}
 */
import type { AuthTokensResponse, CurrentUserResponse } from "@/src/core/infrastructure/http/dto";
import {
  apiClient,
  apiSessionRevision,
  type RegisterData,
  type RegisterResponse,
} from "@/src/core/infrastructure/http/api-client";
import { ApiError } from "@/src/core/infrastructure/http/errors";
import { saveTokens } from "@/src/core/infrastructure/storage/token-storage";

/*
 * Registro real.
 *
 * Se conserva esta función porque
 * account-form.tsx de Sebastián ya la utiliza.
 */
export async function register(data: RegisterData): Promise<RegisterResponse> {
  const user = await apiClient.post<RegisterResponse>(
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
  if (!user || typeof user.id !== 'string' || !user.id ||
      typeof user.fullName !== 'string' || typeof user.email !== 'string' ||
      !Array.isArray(user.roles) || !user.roles.includes(data.role)) {
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

  if (!tokens?.accessToken || !tokens?.refreshToken) {
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
  return apiClient.get<CurrentUserResponse>("/me");
}

export type PatientProfileResponse = {
  id: string;
  fullName: string;
  birthDate: string | null;
  age: number | null;
  biologicalSex: string | null;
  managementMode: string;
};

export async function getPatient(
  patientId: string,
): Promise<PatientProfileResponse> {
  return apiClient.get<PatientProfileResponse>(
    `/patients/${encodeURIComponent(patientId)}`,
  );
}
