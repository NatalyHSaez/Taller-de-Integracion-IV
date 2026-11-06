/**
 * Formatos para mostrar los vínculos reales de
 * GET /api/v1/patients/{patientId}/caregivers y /doctors.
 * No inventan datos: un valor ausente se informa como tal.
 */

export const PERMISSION_LABELS: Record<string, string> = {
  PATIENT_PROFILE_VIEW: 'ver perfil',
  MEASUREMENT_CREATE: 'registrar mediciones',
  MEASUREMENT_VIEW: 'consultar mediciones',
  ALERT_VIEW: 'consultar alertas',
};

/** "consultar mediciones, consultar alertas" o "ninguno". Códigos desconocidos se muestran tal cual. */
export function describePermissions(codes: readonly string[] | null | undefined): string {
  const labels = (codes ?? []).map((code) => PERMISSION_LABELS[code] ?? code);
  return labels.length ? labels.join(', ') : 'ninguno';
}

/** Fecha de vinculación legible; null si no viene o es inválida. */
export function formatLinkedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** Identificador corto del vínculo para mostrar (el id completo se usa por dentro). */
export function shortRelationshipId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}
