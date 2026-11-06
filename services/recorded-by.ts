import { getPatientCaregivers, getPatientDoctors, type LinkedUserResponse } from './api';

/**
 * "Registrada por": el backend solo entrega el id de quien registró la lectura
 * (recordedBy). El nombre se obtiene de los vínculos reales del paciente:
 *   GET /patients/{patientId}/caregivers y /doctors
 * Solo el paciente puede consultar esas listas; el cuidador conoce su propio
 * nombre y el del paciente. Si no se puede saber, no se inventa un nombre.
 */

export type LinkedPeople = { caregivers: LinkedUserResponse[]; doctors: LinkedUserResponse[] };

export type RecordedByInput = {
  recordedBy: string | null | undefined;
  patientId: string;
  patientName?: string | null;
  viewer: { id: string; fullName?: string | null; isPatient: boolean } | null;
  people?: LinkedPeople | null;
};

export function describeRecordedBy(input: RecordedByInput): string | null {
  const { recordedBy, patientId, patientName, viewer, people } = input;
  if (!recordedBy) return null;

  if (viewer && recordedBy === viewer.id) {
    if (viewer.isPatient) return 'Tú';
    return viewer.fullName ? `${viewer.fullName} (tú, como cuidador)` : 'Tú, como cuidador';
  }
  if (recordedBy === patientId) {
    return patientName ? `${patientName} (paciente)` : 'El paciente';
  }
  const caregiver = people?.caregivers.find((person) => person.userId === recordedBy);
  if (caregiver) return `${caregiver.fullName} (cuidador vinculado)`;
  const doctor = people?.doctors.find((person) => person.userId === recordedBy);
  if (doctor) return `${doctor.fullName} (médico vinculado)`;
  return 'Otra persona vinculada al paciente';
}

type Loader = (patientId: string) => Promise<LinkedUserResponse[]>;

const CACHE_MS = 60_000;

/** Vínculos del paciente (para el propio paciente), con caché breve por paciente. */
export function createLinkedPeopleLoader(
  caregivers: Loader = getPatientCaregivers,
  doctors: Loader = getPatientDoctors,
  now: () => number = Date.now,
) {
  const cache = new Map<string, { at: number; promise: Promise<LinkedPeople> }>();
  return {
    load(patientId: string): Promise<LinkedPeople> {
      const hit = cache.get(patientId);
      if (hit && now() - hit.at < CACHE_MS) return hit.promise;
      const promise = Promise.all([caregivers(patientId), doctors(patientId)]).then(([c, d]) => ({
        caregivers: c ?? [],
        doctors: d ?? [],
      }));
      cache.set(patientId, { at: now(), promise });
      // Un error no queda guardado: el próximo intento vuelve a consultar.
      promise.catch(() => cache.delete(patientId));
      return promise;
    },
    clear() {
      cache.clear();
    },
  };
}

export const linkedPeopleLoader = createLinkedPeopleLoader();
