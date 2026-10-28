import {
  AuthUser,
  getMe
} from '@/services/api';
import { authSession } from '@/services/auth-session';
import { demo } from '@/services/demo-store';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
} from '@/services/token-storage';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  authenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  restoreSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  
async function restoreSession(): Promise<void> {
  setLoading(true);

  try {
    const accessToken = await getAccessToken();
    const refreshToken = await getRefreshToken();

    if (!accessToken || !refreshToken) {
      authSession.clear();
      demo.clearSessionData();
      setUser(null);
      return;
    }

    authSession.startBackend({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 3600,
    });

    // getMe() utiliza apiRequest(), que ya realiza
    // la renovación automática ante un error 401.
    const currentUser = await getMe();

    // Sincronizamos también los tokens que hayan
    // podido renovarse durante la solicitud.
    const currentAccessToken = await getAccessToken();
    const currentRefreshToken = await getRefreshToken();

    if (currentAccessToken && currentRefreshToken) {
      authSession.startBackend({
        access_token: currentAccessToken,
        refresh_token: currentRefreshToken,
        token_type: 'bearer',
        expires_in: 3600,
      });
    }

    authSession.setUser(currentUser);
    demo.startBackendSession(currentUser);
    setUser(currentUser);
  } catch (error) {
    console.warn(
      '[auth] No fue posible restaurar la sesión:',
      error,
    );

    authSession.clear();
    demo.clearSessionData();
    setUser(null);

    // No eliminamos los tokens aquí por posibles
    // errores temporales de conexión.
  } finally {
    setLoading(false);
  }
}
  
async function signOut(): Promise<void> {
  try {
    await clearTokens();
  } finally {
    authSession.clear();
    demo.clearSessionData();
    setUser(null);
  }
}

  useEffect(() => {
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
    throw new Error(
      'useAuth debe utilizarse dentro de AuthProvider.',
    );
  }

  return context;
}
