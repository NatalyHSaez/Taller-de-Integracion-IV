import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAppState } from '@/src/core/presentation/session/use-app-state';
import { authSession } from '@/src/core/application/session/auth-session';
import { getApiErrorMessage } from '@/src/core/domain/errors';
import { listPatientConditions } from '@/src/modules/monitoring/application/use-cases/patient-conditions';
import type { PatientCondition } from '@/src/modules/monitoring/domain/patient-condition';

type State = { key: string; items: PatientCondition[] | null; loading: boolean; error: string | null };
export function usePatientConditions() {
  const { user, selectedPatient, permissions, sessionMode } = useAppState();
  const generation = useSyncExternalStore(authSession.subscribe, authSession.generation, authSession.generation);
  const patientId = selectedPatient?.id;
  const allowed = Boolean(sessionMode === 'backend' && user && patientId && permissions.read);
  const key = JSON.stringify([generation, user?.id, patientId, allowed]);
  const [state, setState] = useState<State>({ key: '', items: null, loading: false, error: null });
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    if (!allowed || !patientId) return;
    setState({ key, items: null, loading: true, error: null });
    try {
      const items = await listPatientConditions(patientId);
      if (sequence.current === request) setState({ key, items, loading: false, error: null });
    } catch (error) {
      if (sequence.current === request) setState({ key, items: null, loading: false, error: getApiErrorMessage(error, 'No se pudieron consultar las condiciones asignadas.') });
    }
  }, [allowed, patientId, key]);
  useFocusEffect(useCallback(() => {
    void load();
    return () => { sequence.current++; };
  }, [load]));
  useEffect(() => () => { sequence.current++; }, []);
  const current = state.key === key && allowed ? state : { items: null, loading: allowed, error: null };
  return { ...current, allowed, patientId, patientName: selectedPatient?.name, refresh: load };
}
