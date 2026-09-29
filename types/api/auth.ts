import type { UUID, UserRole, UserStatus } from './common';

/**
 * Respuesta provisional de POST /api/v1/auth/login y /auth/refresh.
 * La propuesta confirma ambos tokens, pero no fija los nombres exactos
 * de las propiedades JSON. Ajustar cuando Integración II publique OpenAPI.
 */
export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
};

/**
 * Respuesta provisional de GET /api/v1/me.
 * Los campos se basan en users + user_profiles + user_roles de la propuesta.
 */
export type CurrentUserResponse = {
  userId: UUID;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  roles: UserRole[];
};
