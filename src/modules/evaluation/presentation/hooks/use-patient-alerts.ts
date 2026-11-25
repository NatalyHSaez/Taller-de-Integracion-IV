import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createPatientAlerts } from '../../application/use-cases/patient-alerts';
import type { AlertsService } from '../../domain/alert';

/** El controlador pertenece exclusivamente a esta sesión y paciente. */
export function usePatientAlerts(service: AlertsService, scope: string, patientId: string | null) {
  const controller = useMemo(
    () => createPatientAlerts(service, { initialFilter: 'OPEN' }),
    [service, scope, patientId],
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  useEffect(() => {
    void controller.setPatient(patientId);
    return () => { void controller.setPatient(null); };
  }, [controller, patientId]);
  return { controller, state };
}
