/**
 * Endpoints del microservicio de relaciones (a través del API Gateway):
 *   GET /me/patients, GET /patients/{id}/caregivers y /doctors,
 *   PUT /caregiver-relationships/{id}/permissions,
 *   DELETE /caregiver-relationships/{id} y /doctor-relationships/{id},
 *   POST /patients/{id}/link-codes y POST /link-codes/consume
 */
import { apiClient } from "@/src/core/infrastructure/http/api-client";

/*
 * Pacientes reales vinculados al cuidador o médico.
 * GET /api/v1/me/patients
 */
export type MyPatientResponse = {
  patientId: string;
  fullName: string;
  relationshipId: string;
  relationshipType: "CAREGIVER" | "DOCTOR";
  permissions: string[];
  linkedAt: string;
};

export async function getMePatients(): Promise<MyPatientResponse[]> {
  return apiClient.get<MyPatientResponse[]>("/me/patients");
}

/*
 * TI4-66: Listados reales de cuidadores y médicos
 * vinculados a un paciente.
 */

export type LinkedUserResponse = {
  relationshipId: string;
  userId: string;
  fullName: string;
  permissions: string[];
  linkedAt: string;
};

export async function getPatientCaregivers(
  patientId: string,
): Promise<LinkedUserResponse[]> {
  return apiClient.get<LinkedUserResponse[]>(
    `/patients/${encodeURIComponent(patientId)}/caregivers`,
  );
}

export async function getPatientDoctors(
  patientId: string,
): Promise<LinkedUserResponse[]> {
  return apiClient.get<LinkedUserResponse[]>(
    `/patients/${encodeURIComponent(patientId)}/doctors`,
  );
}

/* TI4-67: Gestión real de permisos y revocación. */
export async function updateCaregiverPermissions(
  relationshipId: string,
  permissions: string[],
): Promise<LinkedUserResponse> {
  return apiClient.put<LinkedUserResponse>(
    `/caregiver-relationships/${encodeURIComponent(relationshipId)}/permissions`,
    { permissions },
  );
}

export async function revokeCaregiverRelationship(
  relationshipId: string,
): Promise<void> {
  return apiClient.delete<void>(
    `/caregiver-relationships/${encodeURIComponent(relationshipId)}`,
  );
}

export async function revokeDoctorRelationship(
  relationshipId: string,
): Promise<void> {
  return apiClient.delete<void>(
    `/doctor-relationships/${encodeURIComponent(relationshipId)}`,
  );
}

/*
 * Generar un código temporal de vinculación.
 * POST /api/v1/patients/{patientId}/link-codes
 */
export type LinkCodeResponse = {
  id: string;
  code: string;
  type: "CAREGIVER" | "DOCTOR";
  expiresAt: string;
};

export async function createPatientLinkCode(
  patientId: string,
  type: "CAREGIVER" | "DOCTOR" = "CAREGIVER",
): Promise<LinkCodeResponse> {
  return apiClient.post<LinkCodeResponse>(
    `/patients/${encodeURIComponent(patientId)}/link-codes`,
    { type },
  );
}

/*
 * Consumir un código de vinculación.
 * POST /api/v1/link-codes/consume
 */
export type ConsumeLinkCodeResponse = {
  relationshipId: string;
  relationshipType: "CAREGIVER" | "DOCTOR";
  patientId: string;
  patientName: string;
  permissions: string[];
  linkedAt: string;
};

export async function consumeLinkCode(
  code: string,
): Promise<ConsumeLinkCodeResponse> {
  return apiClient.post<ConsumeLinkCodeResponse>(
    "/link-codes/consume",
    { code: code.trim().toUpperCase() },
  );
}
