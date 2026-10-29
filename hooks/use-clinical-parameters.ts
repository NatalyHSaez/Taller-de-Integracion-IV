import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type ClinicalParameterCatalog,
  clinicalParametersService,
} from '@/services/clinical-parameters';
import { getApiErrorMessage } from '@/services/errors';

type State = {
  catalog: ClinicalParameterCatalog | null;
  loading: boolean;
  error: string | null;
};

/** Carga el catálogo clínico con estados de carga, error y reintento. */
export function useClinicalParameters() {
  const [state, setState] = useState<State>({
    catalog: null,
    loading: true,
    error: null,
  });
  const mounted = useRef(true);

  const load = useCallback(async (forceRefresh = false) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const catalog = await clinicalParametersService.list({ forceRefresh });
      if (mounted.current) setState({ catalog, loading: false, error: null });
    } catch (cause) {
      if (mounted.current) {
        setState({
          catalog: null,
          loading: false,
          error: getApiErrorMessage(
            cause,
            'No se pudo cargar el catálogo de mediciones.',
          ),
        });
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const retry = useCallback(() => load(true), [load]);

  return { ...state, retry };
}
