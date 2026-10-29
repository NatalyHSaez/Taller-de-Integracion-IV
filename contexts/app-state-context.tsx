import {
  createContext,
  useEffect,
  type PropsWithChildren,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

import { appState, type GlobalAppState } from '@/services/app-state';
import { patientAccess } from '@/services/patient-access';

type AppStateContextValue = GlobalAppState & {
  selectPatient: (patientId: string) => Promise<void>;
  refreshPatients: () => Promise<void>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const state = useSyncExternalStore(
    appState.subscribe,
    appState.snapshot,
    appState.snapshot,
  );

  useEffect(() => {
    if (state.sessionMode === 'backend' && state.user?.role === 'caregiver') {
      void patientAccess.ensureLoaded().catch(() => {
        // El estado observable ya contiene el error, y select-patient ofrece reintentar.
      });
    } else {
      patientAccess.clear();
    }
  }, [state.sessionMode, state.user?.id, state.user?.role]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      ...state,
      selectPatient: appState.selectPatient,
      refreshPatients: appState.refreshPatients,
    }),
    [state],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppStateContext(): AppStateContextValue {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState debe utilizarse dentro de AppStateProvider.');
  }

  return context;
}
