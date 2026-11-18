/**
 * Documento clínico del paciente (microservicio de Atención: recetas, órdenes
 * de exámenes y otros archivos que sube el médico tras una consulta).
 */
export type DocumentKind = 'prescription' | 'exam_order' | 'other';

export type ClinicalDocument = {
  id: string;
  fileName: string;
  kind: DocumentKind;
};

export type DocumentFilter = 'ALL' | DocumentKind;

/** Nombre sin la extensión: "Receta médica.pdf" → "Receta médica". */
export function documentTitle(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]{2,5}$/i, '');
}

/** Extensión en mayúsculas ("PDF") o null si el archivo no tiene. */
export function documentFormat(fileName: string): string | null {
  const match = /\.([a-z0-9]{2,5})$/i.exec(fileName);
  return match ? match[1].toUpperCase() : null;
}

export function filterDocuments(documents: readonly ClinicalDocument[], filter: DocumentFilter): ClinicalDocument[] {
  return filter === 'ALL' ? [...documents] : documents.filter((document) => document.kind === filter);
}

export function countByKind(documents: readonly ClinicalDocument[]): Record<DocumentFilter, number> {
  const counts: Record<DocumentFilter, number> = { ALL: documents.length, prescription: 0, exam_order: 0, other: 0 };
  for (const document of documents) counts[document.kind] += 1;
  return counts;
}
