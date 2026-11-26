import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

import { appState, type GlobalAppState } from '@/src/core/application/session/app-state';

type AppStateContextValue = GlobalAppState & {
  // En la arquitectura de main la selección es sincrónica y valida el vínculo.
  selectPatient: (patientId: string) => void;
  // Equivalente al refreshPatients de Cristian, usando GET /me/patients de main.
  refreshPatients: () => Promise<void>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const state = useSyncExternalStore(
    appState.subscribe,
    appState.snapshot,
    appState.snapshot,
  );

  const value = useMemo<AppStateContextValue>(
    () => ({
      ...state,
      selectPatient: appState.selectPatient,
      refreshPatients: appState.loadRealPatients,
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
