import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import type { CurrentUserResponse } from '@/src/core/domain/contracts';
import { authSession } from '@/src/core/application/session/auth-session';
import { authService } from '@/src/modules/identity/application/use-cases/auth-service';

type AuthContextValue = {
  user: CurrentUserResponse | null;
  loading: boolean;
  authenticated: boolean;
  setUser: (user: CurrentUserResponse | null) => void;
  restoreSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  // Una fuente observable para toda la app: login, refresh, /me y logout.
  // useSyncExternalStore recibe snapshots estables hasta el siguiente publish.
  const session = useSyncExternalStore(
    authSession.subscribe,
    authSession.snapshot,
    authSession.snapshot,
  );
  const [loading, setLoading] = useState(true);

  const restoreSession = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await authService.restore();
    } catch {
      // Un fallo de red no debe dejar el indicador de carga bloqueado.
      // authService determina si los tokens se deben conservar o invalidar.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void restoreSession(); });
    return () => { active = false; };
  }, [restoreSession]);

  // La identidad proviene exclusivamente de /me y del estado de sesión real.
  const user = session.mode === 'backend' ? session.user : null;

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    authenticated: user !== null,
    setUser: (nextUser) => authSession.setUser(nextUser),
    restoreSession,
    signOut: () => authService.logout(),
  }), [user, loading, restoreSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  return value;
}
