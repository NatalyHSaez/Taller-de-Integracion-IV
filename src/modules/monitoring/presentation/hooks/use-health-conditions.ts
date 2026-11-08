import { useCallback, useEffect, useRef, useState } from 'react';

import { getApiErrorMessage } from '@/src/core/infrastructure/http/errors';
import { type HealthProgram, healthConditionsService } from '@/src/modules/monitoring/application/health-conditions';

type State = {
  programs: HealthProgram[] | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

/** Carga el catálogo de programas con estados de carga, error y actualización. */
export function useHealthConditions() {
  const [state, setState] = useState<State>({
    programs: null,
    loading: true,
    refreshing: false,
    error: null,
  });
  const mounted = useRef(true);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'retry') => {
    setState((prev) => ({
      ...prev,
      loading: mode !== 'refresh',
      refreshing: mode === 'refresh',
      error: null,
    }));
    try {
      const programs = await healthConditionsService.list({
        forceRefresh: mode !== 'initial',
      });
      if (mounted.current) {
        setState({ programs, loading: false, refreshing: false, error: null });
      }
    } catch (cause) {
      if (mounted.current) {
        setState((prev) => ({
          // Si ya había datos, se conservan y solo se informa el error.
          programs: prev.programs,
          loading: false,
          refreshing: false,
          error: getApiErrorMessage(cause, 'No se pudo cargar el catálogo de programas.'),
        }));
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load('initial');
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const refresh = useCallback(() => load('refresh'), [load]);
  const retry = useCallback(() => load('retry'), [load]);

  return { ...state, refresh, retry };
}
