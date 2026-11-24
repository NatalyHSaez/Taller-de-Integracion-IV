export type MyPatientResponse = {
  patientId: string;
  fullName: string;
  relationshipId: string;
  relationshipType: "CAREGIVER" | "DOCTOR";
  permissions: string[];
  linkedAt: string;
};

export type LinkedUserResponse = {
  relationshipId: string;
  userId: string;
  fullName: string;
  permissions: string[];
  linkedAt: string;
};

export type LinkCodeResponse = {
  id: string;
  code: string;
  type: "CAREGIVER" | "DOCTOR";
  expiresAt: string;
};

export type ConsumeLinkCodeResponse = {
  relationshipId: string;
  relationshipType: "CAREGIVER" | "DOCTOR";
  patientId: string;
  patientName: string;
  permissions: string[];
  linkedAt: string;
};
