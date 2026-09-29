import type { DoctorRegistryStatus, ISODateTime, UUID } from './common';

/** Perfil profesional provisional para las vistas móviles que necesiten datos del médico. */
export type DoctorProfileResponse = {
  doctorId: UUID;
  userId: UUID;
  firstName: string;
  lastName: string;
  profession: string;
  registryStatus: DoctorRegistryStatus;
  verifiedAt: ISODateTime | null;
};

export type DoctorVerificationResponse = {
  doctorId: UUID;
  registryStatus: DoctorRegistryStatus;
  verifiedAt: ISODateTime | null;
};
