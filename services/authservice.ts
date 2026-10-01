import { clearTokens } from './token-storage';
import { demo } from './demo-store';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const authService = {
  hasLocalAccount: (email: string) => {
    const normalizedEmail = normalizeEmail(email);

    return demo
      .snapshot()
      .accounts.some(
        (account) =>
          account.email === normalizedEmail && account.password.length > 0,
      );
  },

  login: async (email: string, password: string) => {
    await clearTokens();
    demo.login(normalizeEmail(email), password);
  },

  register: async (data: { name: string; email: string; password: string }) => {
    demo.registerCaregiver(
      data.name,
      normalizeEmail(data.email),
      data.password,
    );

    // El formulario dirige al login después de crear la cuenta.
    demo.logout();
  },

  getPatients: async () => demo.patients(),
};
