import type { PatientProfileResponse } from '../domain/patient-profile';
import type { AuthTokensResponse, CurrentUserResponse, RegisterRequest, UpdateMeRequest } from '@/src/core/domain/contracts';

export type IdentityDependencies = {
  getPatient: (patientId: string) => Promise<PatientProfileResponse>;
  isConfigured: () => boolean;
  revision: () => number;
  login: (email: string, password: string) => Promise<AuthTokensResponse>;
  register: (data: RegisterRequest) => Promise<CurrentUserResponse>;
  getMe: (retry: boolean) => Promise<CurrentUserResponse>;
  updateMe: (data: UpdateMeRequest) => Promise<CurrentUserResponse>;
  revoke: (refreshToken: string) => Promise<void>;
  refresh: () => Promise<string | null>;
  clearCache: () => void;
  clearTokens: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  getRefreshToken: () => Promise<string | null>;
};

let dependencies: IdentityDependencies | undefined;
export function configureIdentity(deps: IdentityDependencies): void {
  dependencies = deps;
}
export function identityDependencies(): IdentityDependencies {
  if (!dependencies) throw new Error('El módulo de identidad no está configurado.');
  return dependencies;
}

export async function getPatient(patientId: string): Promise<PatientProfileResponse> {
  return identityDependencies().getPatient(patientId);
}
