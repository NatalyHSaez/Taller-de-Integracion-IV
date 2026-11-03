import { AuthUser } from '@/services/api';
import { authSession } from '@/services/auth-session';
import { authService } from '@/services/authservice';
import { createContext, PropsWithChildren, useContext, useEffect, useState, } from 'react';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  authenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  restoreSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Publica la identidad del login sin depender de que la pantalla siga montada.
  useEffect(() => authSession.subscribe(() => {
    setUser(authSession.mode() === 'backend' ? authSession.user() : null);
  }), []);

  async function restoreSession() {
    try {
      await authService.restore();
    } catch {
      // El servicio limpia memoria; conserva tokens si solo falla la red.
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await authService.logout();
  }

  useEffect(() => {
    // La actualización ocurre después de leer almacenamiento/red de forma asíncrona.
    void restoreSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authenticated: user !== null,
        setUser,
        restoreSession,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  }

  return context;
}
