export type PatientProfileResponse = {
  id: string;
  fullName: string;
  birthDate: string | null;
  age: number | null;
  biologicalSex: string | null;
  managementMode: string;
};

