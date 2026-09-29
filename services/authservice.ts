import { demo } from './demo-store';
import { mockApi } from './mocks/api-mock';
import { findMockAccount } from './mocks/auth-mock';

export const authService = {
  login: async (email: string, password: string) => {
    const account = findMockAccount(email, password);

    if (account?.role === 'DOCTOR') {
      throw new Error('El acceso médico se probará desde el flujo profesional.');
    }

    const tokens = await mockApi.auth.login(email, password);

    try {
      // Mantiene el estado local que las pantallas actuales todavía utilizan.
      demo.login(email, password);
    } catch (error) {
      await mockApi.auth.logout();
      throw error;
    }

    return tokens;
  },

  logout: async () => {
    await mockApi.auth.logout();
    demo.logout();
  },

  register: async (data: { name: string; email: string; password: string }) =>
    demo.registerCaregiver(data.name, data.email, data.password),

  getPatients: async () => demo.patients(),
};
