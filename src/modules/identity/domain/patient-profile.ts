export type PatientProfileResponse = {
  id: string;
  fullName: string;
  birthDate: string | null;
  age: number | null;
  biologicalSex: string | null;
  managementMode: string | null;
};


/** PatientOut: campos clínicos presentes, aunque su valor pueda ser null. */
export function isPatientProfileResponse(value: unknown): value is PatientProfileResponse {
  const p = value as Partial<PatientProfileResponse> | null;
  if (!p || typeof p.id !== 'string' || !p.id.trim() ||
      typeof p.fullName !== 'string' || !p.fullName.trim()) return false;
  const nullableText = (v: unknown) => v === null || typeof v === 'string';
  const validDate = (v: unknown) => {
    if (v === null) return true;
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const date = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
  };
  return validDate(p.birthDate) &&
    (p.age === null || (typeof p.age === 'number' && Number.isSafeInteger(p.age) && p.age >= 0)) &&
    nullableText(p.biologicalSex) && nullableText(p.managementMode);
}
