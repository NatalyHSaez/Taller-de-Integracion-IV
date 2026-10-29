import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { CurrentUserResponse } from '@/types/api';
import { authSession } from '@/services/auth-session';
import { authService } from '@/services/authservice';

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
  const session = useSyncExternalStore(authSession.subscribe, authSession.snapshot, authSession.snapshot);
  const [loading, setLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    setLoading(true);
    try { await authService.restore(); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void restoreSession(); }, [restoreSession]);

  return <AuthContext.Provider value={{
    user: session.user,
    loading,
    authenticated: Boolean(session.user),
    setUser: (user) => authSession.setUser(user),
    restoreSession,
    signOut: () => authService.logout(),
  }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  return value;
}
