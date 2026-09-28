import { demo } from './demo-store';
export const authService = {
  login: async (email: string, password: string) => demo.login(email, password),
  register: async (data: { name: string; email: string; password: string }) => demo.registerCaregiver(data.name, data.email, data.password),
  getPatients: async () => demo.patients(),
};
