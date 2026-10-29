import { authSession } from './auth-session';
import { authService } from './authservice';
import { dataClient } from './data';
import { normalizeApiError } from './errors';
import { gatewayService } from './gateway';
import { patientAccess } from './patient-access';
import type { ReadingPageResponse } from '@/types/api';

export type P7Step = {
  key: 'gateway' | 'identity' | 'patients' | 'profile' | 'readings';
  status: 'ok' | 'warning' | 'error';
  description: string;
};

export type P7Report = {
  ready: boolean;
  steps: P7Step[];
};

/**
 * Diagnóstico explícito desde Expo. No crea lecturas ni cambia permisos.
 * El modo mock nunca llega al Gateway. La ejecución no conserva información clínica.
 */
export async function verifyP7Integration(): Promise<P7Report> {
  const steps: P7Step[] = [];
  if (authSession.mode() !== 'backend' || !authSession.user()) {
    return { ready: false, steps: [{ key: 'identity', status: 'error',
      description: 'Inicia sesión con el backend real para comprobar la integración.' }] };
  }

  const generation = authSession.generation();
  const assertSession = () => {
    if (authSession.mode() !== 'backend' || authSession.generation() !== generation) {
      throw new Error('La sesión cambió durante la verificación. Vuelve a intentarlo.');
    }
  };
  const failure = (key: P7Step['key'], cause: unknown) => {
    steps.push({ key, status: 'error', description: normalizeApiError(cause).message });
  };

  try {
    const response = await gatewayService.healthFresh();
    assertSession();
    const faulty = Object.entries(response.servicios ?? {})
      .filter(([, status]) => status !== 'ok').map(([service]) => service);
    if (response.status !== 'ok' || faulty.length > 0) {
      steps.push({ key: 'gateway', status: 'error',
        description: `Gateway degradado. Revisar: ${faulty.join(', ') || 'servicios internos'}.` });
    } else {
      steps.push({ key: 'gateway', status: 'ok',
        description: 'Gateway y microservicios responden correctamente.' });
    }
  } catch (cause) {
    failure('gateway', cause);
  }

  let patientId: string | null = null;
  let canRead = false;
  let canViewProfile = false;
  try {
    const me = await authService.me();
    assertSession();
    steps.push({ key: 'identity', status: 'ok', description: 'Sesión real y GET /me verificados.' });
    if (me.roles.includes('PATIENT')) {
      patientId = me.id;
      canRead = true;
      canViewProfile = true;
      steps.push({ key: 'patients', status: 'ok', description: 'Paciente propio identificado por UUID real.' });
    } else if (me.roles.includes('CAREGIVER')) {
      try {
        const relations = await patientAccess.refresh();
        assertSession();
        const selected = patientAccess.snapshot().selectedId;
        const relation = relations.find((item) => item.patientId === selected);
        if (!relation) {
          steps.push({ key: 'patients', status: 'warning',
            description: relations.length
              ? 'Vinculaciones cargadas. Selecciona un paciente y vuelve a comprobar.'
              : 'El cuidador no tiene pacientes vinculados. Se necesita una vinculación real.' });
        } else {
          patientId = relation.patientId;
          canRead = relation.permissions.includes('MEASUREMENT_VIEW');
          canViewProfile = relation.permissions.includes('PATIENT_PROFILE_VIEW');
          steps.push({ key: 'patients', status: 'ok',
            description: 'Paciente seleccionado y relación vigente comprobada.' });
        }
      } catch (cause) {
        failure('patients', cause);
      }
    } else {
      steps.push({ key: 'patients', status: 'error', description: 'El rol no tiene flujo móvil habilitado.' });
    }
  } catch (cause) {
    failure('identity', cause);
  }

  if (patientId && canViewProfile) {
    try {
      const profile = await patientAccess.getProfile(patientId);
      assertSession();
      if (profile.id !== patientId) throw new Error('El backend devolvió otro paciente.');
      steps.push({ key: 'profile', status: 'ok', description: 'Ficha del paciente autorizado disponible.' });
    } catch (cause) {
      failure('profile', cause);
    }
  } else {
    steps.push({ key: 'profile', status: 'warning', description: patientId
      ? 'La relación no concede PATIENT_PROFILE_VIEW.' : 'Sin paciente seleccionado para consultar ficha.' });
  }

  if (patientId && canRead) {
    try {
      const list = await dataClient.get<ReadingPageResponse>(`/patients/${patientId}/readings`, {
        query: { page: 1, size: 1 }, cache: false, retry: false,
      });
      assertSession();
      if (!Number.isInteger(list.total) || !Array.isArray(list.items)) {
        throw new Error('El backend devolvió un historial inválido.');
      }
      steps.push({ key: 'readings', status: list.total > 0 ? 'ok' : 'warning',
        description: list.total > 0
          ? `Historial accesible; ${list.total} lectura(s) real(es) disponibles para Sprint 2.`
          : 'Historial accesible, pero sin lecturas reales para probar S1/S2.' });
    } catch (cause) {
      failure('readings', cause);
    }
  } else {
    steps.push({ key: 'readings', status: 'warning', description: patientId
      ? 'Sin permiso MEASUREMENT_VIEW para consultar lecturas.'
      : 'No es posible verificar lecturas sin un paciente autorizado.' });
  }

  // Si la sesión cambió durante el diagnóstico, ningún resultado debe considerarse válido.
  try { assertSession(); }
  catch (cause) { return { ready: false, steps: [{ key: 'identity', status: 'error', description: String((cause as Error).message) }] }; }
  return {
    ready: steps.every((step) => step.status === 'ok'),
    steps,
  };
}
