import type {
  BiologicalSex,
  ISODate,
  PatientManagementMode,
  UUID,
} from './common';

/**
 * Resumen provisional usado por GET /api/v1/me/patients.
 * El endpoint existe en la propuesta, pero su JSON exacto aún no está definido.
 */
export type PatientSummaryResponse = {
  patientId: UUID;
  firstName: string;
  lastName: string;
  managementMode: PatientManagementMode;
};

/**
 * Perfil provisional de GET /api/v1/patients/{patientId}/profile.
 */
export type PatientProfileResponse = {
  patientId: UUID;
  firstName: string;
  lastName: string;
  birthDate: ISODate;
  biologicalSex: BiologicalSex | null;
  managementMode: PatientManagementMode;
};
