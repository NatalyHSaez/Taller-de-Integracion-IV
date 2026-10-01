import { AuthUser, getMe } from '@/services/api';
import { clearTokens, getAccessToken } from '@/services/token-storage';
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

  async function restoreSession() {
    try {
        setLoading(true);

        const accessToken = await getAccessToken();

        if (!accessToken) {
        setUser(null);
        return;
        }

        const currentUser = await getMe();

        setUser(currentUser);
    } catch (error) {
        // TEMPORALMENTE no borramos el token
        // para poder diagnosticar qué está ocurriendo.
        setUser(null);
    } finally {
        setLoading(false);
    }
    }

  async function signOut() {
    await clearTokens();
    setUser(null);
  }

  useEffect(() => {
  void restoreSession();
  return () => {
  };
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