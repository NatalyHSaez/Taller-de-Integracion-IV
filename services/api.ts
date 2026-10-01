import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '@/services/token-storage';

/**
 * IMPORTANTE:
 * Esta es la IP local del notebook donde está corriendo Docker.
 *
 * El teléfono con Expo Go debe estar conectado a la misma red Wi-Fi.
 *
 * Si cambia la IP del notebook, habrá que actualizar esta dirección.
 */
export const API_BASE_URL = 'http://192.168.1.24:8000/api/v1';

/**
 * Tokens entregados por el backend.
 */
export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

/**
 * Usuario autenticado.
 */
export type AuthUser = {
  id?: string;
  correo?: string;
  email?: string;
  nombre?: string;
  apellido?: string;
  nombre_completo?: string;
  roles?: string[];
  rol?: string;
  [key: string]: unknown;
};

/**
 * Datos necesarios para registrar una cuenta.
 */
export type RegisterData = {
  nombre_completo: string;
  correo: string;
  password: string;
  rol: string;
};

/**
 * Respuesta del registro.
 *
 * Se deja flexible porque el backend puede devolver
 * información adicional del usuario creado.
 */
export type RegisterResponse = {
  id?: string;
  nombre_completo?: string;
  correo?: string;
  rol?: string;
  roles?: string[];
  message?: string;
  [key: string]: unknown;
};

/**
 * Intenta obtener un mensaje entendible desde una respuesta
 * de error del backend.
 */
async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();

    if (typeof data?.detail === 'string') {
      return data.detail;
    }

    if (typeof data?.message === 'string') {
      return data.message;
    }

    if (typeof data?.error === 'string') {
      return data.error;
    }
  } catch {
    // La respuesta no contenía JSON.
  }

  if (response.status === 400) {
    return 'Los datos enviados no son válidos.';
  }

  if (response.status === 401) {
    return 'Correo o contraseña incorrectos.';
  }

  if (response.status === 403) {
    return 'No tienes permisos para realizar esta acción.';
  }

  if (response.status === 409) {
    return 'Ya existe una cuenta asociada a ese correo electrónico.';
  }

  if (response.status === 422) {
    return 'Revisa los datos ingresados. Uno o más campos no son válidos.';
  }

  if (response.status >= 500) {
    return 'El servidor no está disponible en este momento.';
  }

  return `Error de conexión con el servidor (${response.status}).`;
}

/**
 * Registra una nueva cuenta contra el backend real.
 */
export async function register(
  data: RegisterData
): Promise<RegisterResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/auth/registro`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nombre_completo: data.nombre_completo.trim(),
        correo: data.correo.trim().toLowerCase(),
        password: data.password,
        rol: data.rol,
      }),
    });
  } catch {
    throw new Error(
      'No se pudo conectar con el servidor. Verifica que Docker esté encendido y que el teléfono esté en la misma red Wi-Fi.'
    );
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  /*
   * Algunos endpoints pueden responder 201 sin contenido.
   * Intentamos leer JSON, pero si no existe devolvemos un objeto vacío.
   */
  try {
    return (await response.json()) as RegisterResponse;
  } catch {
    return {};
  }
}

/**
 * Inicia sesión contra el Gateway real.
 */
export async function login(
  correo: string,
  password: string
): Promise<AuthTokens> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        correo: correo.trim().toLowerCase(),
        password,
      }),
    });
  } catch {
    throw new Error(
      'No se pudo conectar con el servidor. Verifica que Docker esté encendido y que el teléfono esté en la misma red Wi-Fi.'
    );
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const data = (await response.json()) as AuthTokens;

  if (!data.access_token || !data.refresh_token) {
    throw new Error('El servidor devolvió una sesión inválida.');
  }

  await saveTokens(
    data.access_token,
    data.refresh_token
  );

  return data;
}

/**
 * Obtiene un nuevo access token usando el refresh token.
 *
 * El backend rota el refresh token, por lo que guardamos
 * ambos tokens nuevos.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      await clearTokens();
      return null;
    }

    const data = (await response.json()) as AuthTokens;

    if (!data.access_token || !data.refresh_token) {
      await clearTokens();
      return null;
    }

    await saveTokens(
      data.access_token,
      data.refresh_token
    );

    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * Peticiones autenticadas.
 *
 * Si el access token expiró:
 * 1. intenta renovarlo;
 * 2. guarda los tokens nuevos;
 * 3. repite una vez la petición original.
 */
export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  let accessToken = await getAccessToken();

  const headers = new Headers(options.headers ?? {});

  headers.set('Content-Type', 'application/json');

  if (accessToken) {
    headers.set(
      'Authorization',
      `Bearer ${accessToken}`
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        headers,
      }
    );
  } catch {
    throw new Error(
      'No se pudo conectar con el servidor. Revisa tu conexión de red.'
    );
  }

  /*
   * Si no es un 401, devolvemos la respuesta normalmente.
   */
  if (response.status !== 401) {
    return response;
  }

  /*
   * Access token expirado.
   * Intentamos renovarlo automáticamente.
   */
  accessToken = await refreshAccessToken();

  if (!accessToken) {
    await clearTokens();
    return response;
  }

  /*
   * Reintentamos la petición original con el nuevo access token.
   */
  headers.set(
    'Authorization',
    `Bearer ${accessToken}`
  );

  try {
    return await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        headers,
      }
    );
  } catch {
    throw new Error(
      'No se pudo conectar con el servidor. Revisa tu conexión de red.'
    );
  }
}

/**
 * Devuelve el usuario correspondiente a la sesión actual.
 */
export async function getMe(): Promise<AuthUser> {
  const response = await fetchWithAuth('/auth/me');

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as AuthUser;
}

/**
 * Cierra la sesión local.
 *
 * Elimina access token y refresh token del almacenamiento seguro.
 */
export async function logoutLocal(): Promise<void> {
  await clearTokens();
}