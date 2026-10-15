import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

import { appState, type GlobalAppState } from '@/services/app-state';

type AppStateContextValue = GlobalAppState & {
  selectPatient: (patientId: string) => void;
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
