import type { ClinicalDocument } from '@/src/modules/care/domain/clinical-document';

// TODO: reemplazar por datos reales cuando esté el endpoint de documentos
// (el gateway ya enruta /api/v1/documents al servicio de Atención, pero aún no expone rutas).
export const DEMO_DOCUMENTS: readonly ClinicalDocument[] = [
  { id: 'receta-medica', fileName: 'Receta médica.pdf', kind: 'prescription' },
  { id: 'orden-examenes', fileName: 'Orden de exámenes.pdf', kind: 'exam_order' },
];

export function findDemoDocument(id: string | undefined): ClinicalDocument | null {
  return DEMO_DOCUMENTS.find((document) => document.id === id) ?? null;
}
