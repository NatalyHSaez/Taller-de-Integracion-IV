/** Contrato propio de la aplicación: no depende del transporte ni de relaciones. */
export type LinkedPatient = {
  patientId: string;
  fullName: string;
  relationshipId: string;
  relationshipType: 'CAREGIVER' | 'DOCTOR';
  permissions: string[];
  linkedAt: string;
};

export type AppStateDependencies = {
  /** La respuesta se valida antes de conceder permisos o publicar datos. */
  listLinkedPatients: () => Promise<unknown>;
  clearClinicalCache: () => void;
};
