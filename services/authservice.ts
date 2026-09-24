import authMock from './mocks/auth.json';
import patientsMock from './mocks/patients.json';

// Cambia a false cuando Integración II tenga listos los servidores reales
const USE_MOCK = true;
const API_URL = 'https://api.tusaludapp.com/api/v1';

export interface Patient {
  id: string;
  fullName: string;
  type: 'autonomous' | 'assisted';
  age: number;
  relationship: string;
}

export const authService = {
  // 1. Iniciar Sesión
  login: async (email: string, pass: string) => {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 1000)); // Simula retardo de red de 1 seg

      if (email === 'error@ejemplo.com') {
        throw new Error(authMock.errors.invalidCredentials.message);
      }

      return authMock.loginSuccess;
    }

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pass }),
    });

    if (!response.ok) throw new Error('Error de autenticación');
    return await response.json();
  },

  // 2. Registro de Usuario
  register: async (userData: any) => {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 1200));

      if (userData.email === 'existe@ejemplo.com') {
        throw new Error(authMock.errors.userExists.message);
      }

      return { status: 201, message: 'Usuario registrado con éxito' };
    }

    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    if (!response.ok) throw new Error('Error al registrar usuario');
    return await response.json();
  },

  // 3. Obtener pacientes vinculados (/me/patients)
  getPatients: async (): Promise<Patient[]> => {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 800));
      return patientsMock.patients as Patient[];
    }

    const response = await fetch(`${API_URL}/me/patients`);
    if (!response.ok) throw new Error('Error al obtener la lista de pacientes');
    return await response.json();
  }
};