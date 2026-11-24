import { apiClient } from './api-client';
import { normalizeApiError } from './errors';
import type { CurrentUserResponse, HealthResponse } from './dto';

import type { P7CheckContext, P7Report, P7Step } from '../../domain/integration-check';
export type { P7CheckContext, P7Report, P7Step } from '../../domain/integration-check';

type Relationship = {
  patientId: string;
  permissions: string[];
};

type PatientProfile = { id: string };
type ReadingPage = { total: number; items: unknown[] };

function changedSession(): P7Report {
  return {
    ready: false,
    steps: [{
      key: 'identity',
      status: 'error',
      description: 'La sesión o el paciente seleccionado cambió durante la comprobación. Vuelve a intentarlo.',
    }],
  };
}

/** No utiliza mocks ni modifica cuentas, permisos o mediciones. */
export async function verifyP7Integration(context: P7CheckContext): Promise<P7Report> {
  if (!context.userId || !context.isCurrent()) {
    return {
      ready: false,
      steps: [{
        key: 'identity',
        status: 'error',
        description: 'Inicia sesión con el backend real para comprobar la integración.',
      }],
    };
  }

  const steps: P7Step[] = [];
  const errorStep = (key: P7Step['key'], cause: unknown): void => {
    steps.push({ key, status: 'error', description: normalizeApiError(cause).message });
  };
  const current = () => context.isCurrent();

  // El endpoint público debe responder sin credenciales y sin caché.
  try {
    const health = await apiClient.get<HealthResponse>('/health', {
      auth: false,
      acceptedStatuses: [503],
      timeoutMs: 8_000,
    });
    if (!current()) return changedSession();
    const faulty = Object.entries(health.servicios ?? {})
      .filter(([, status]) => status !== 'ok')
      .map(([service]) => service);
    const healthy = health.status === 'ok' && faulty.length === 0;
    steps.push({
      key: 'gateway',
      status: healthy ? 'ok' : 'error',
      description: healthy
        ? 'Gateway y microservicios responden correctamente.'
        : `Gateway degradado. Revisar: ${faulty.join(', ') || 'servicios internos'}.`,
    });
  } catch (cause) {
    if (!current()) return changedSession();
    errorStep('gateway', cause);
  }

  let patientId: string | null = null;
  let canRead = false;
  let canViewProfile = false;
  try {
    const me = await apiClient.get<CurrentUserResponse>('/me');
    if (!current()) return changedSession();
    if (!me || me.id !== context.userId || !me.roles?.some(role => context.roles.includes(role))) {
      throw new Error('El backend devolvió una identidad o un rol distinto a la sesión activa.');
    }
    steps.push({ key: 'identity', status: 'ok', description: 'Sesión real y GET /me verificados.' });

    if (me.roles.includes('PATIENT')) {
      patientId = me.id;
      canRead = true;
      canViewProfile = true;
      steps.push({ key: 'patients', status: 'ok', description: 'Paciente propio identificado por su UUID real.' });
    } else if (me.roles.includes('CAREGIVER')) {
      try {
        const relations = await apiClient.get<Relationship[]>('/me/patients');
        if (!current()) return changedSession();
        if (!Array.isArray(relations)) throw new Error('El servidor devolvió una lista de vínculos inválida.');
        const relation = relations.find(item => item.patientId === context.selectedPatientId);
        if (relation) {
          patientId = relation.patientId;
          canRead = relation.permissions?.includes('MEASUREMENT_VIEW') ?? false;
          canViewProfile = relation.permissions?.includes('PATIENT_PROFILE_VIEW') ?? false;
          steps.push({ key: 'patients', status: 'ok', description: 'Paciente seleccionado y vínculo vigente comprobados.' });
        } else {
          steps.push({
            key: 'patients', status: 'warning',
            description: relations.length
              ? 'Vinculaciones cargadas. Selecciona un paciente autorizado y vuelve a comprobar.'
              : 'Este cuidador todavía no tiene pacientes vinculados.',
          });
        }
      } catch (cause) {
        if (!current()) return changedSession();
        errorStep('patients', cause);
      }
    } else {
      steps.push({ key: 'patients', status: 'error', description: 'El rol no tiene un flujo móvil habilitado.' });
    }
  } catch (cause) {
    if (!current()) return changedSession();
    errorStep('identity', cause);
  }

  if (patientId && canViewProfile) {
    try {
      const profile = await apiClient.get<PatientProfile>(`/patients/${encodeURIComponent(patientId)}`);
      if (!current()) return changedSession();
      if (profile?.id !== patientId) throw new Error('El backend devolvió la ficha de otro paciente.');
      steps.push({ key: 'profile', status: 'ok', description: 'Ficha del paciente autorizado disponible.' });
    } catch (cause) {
      if (!current()) return changedSession();
      errorStep('profile', cause);
    }
  } else {
    steps.push({ key: 'profile', status: 'warning', description: patientId
      ? 'La relación no concede PATIENT_PROFILE_VIEW.'
      : 'Sin paciente autorizado para consultar la ficha.' });
  }

  if (patientId && canRead) {
    try {
      const page = await apiClient.get<ReadingPage>(`/patients/${encodeURIComponent(patientId)}/readings`, {
        query: { page: 1, size: 1 },
      });
      if (!current()) return changedSession();
      if (!Number.isInteger(page?.total) || page.total < 0 || !Array.isArray(page?.items)) {
        throw new Error('El backend devolvió un historial de lecturas inválido.');
      }
      steps.push({
        key: 'readings', status: page.total > 0 ? 'ok' : 'warning',
        description: page.total > 0
          ? `Historial disponible: ${page.total} lectura(s) real(es).`
          : 'Historial disponible, pero todavía sin lecturas reales.',
      });
    } catch (cause) {
      if (!current()) return changedSession();
      errorStep('readings', cause);
    }
  } else {
    steps.push({ key: 'readings', status: 'warning', description: patientId
      ? 'Sin permiso MEASUREMENT_VIEW para consultar lecturas.'
      : 'No es posible verificar lecturas sin un paciente autorizado.' });
  }

  if (!current()) return changedSession();
  return { ready: steps.every(step => step.status === 'ok'), steps };
}
