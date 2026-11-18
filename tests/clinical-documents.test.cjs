/* global projectRequire */
/** Documentos clínicos: nombre, formato, filtros y conteos de la pantalla Documentos. */
const test = require('node:test');
const assert = require('node:assert/strict');

const docs = projectRequire('src/modules/care/domain/clinical-document.ts');
const { DEMO_DOCUMENTS, findDemoDocument } = projectRequire('src/modules/care/infrastructure/demo-documents.ts');

test('título y formato a partir del nombre del archivo', () => {
  assert.equal(docs.documentTitle('Receta médica.pdf'), 'Receta médica');
  assert.equal(docs.documentFormat('Receta médica.pdf'), 'PDF');
  assert.equal(docs.documentTitle('informe'), 'informe');
  assert.equal(docs.documentFormat('informe'), null);
});

test('filtros y conteos por tipo', () => {
  const counts = docs.countByKind(DEMO_DOCUMENTS);
  assert.deepEqual(counts, { ALL: 2, prescription: 1, exam_order: 1, other: 0 });
  assert.deepEqual(docs.filterDocuments(DEMO_DOCUMENTS, 'prescription').map((d) => d.id), ['receta-medica']);
  assert.equal(docs.filterDocuments(DEMO_DOCUMENTS, 'ALL').length, 2);
  assert.equal(docs.filterDocuments(DEMO_DOCUMENTS, 'other').length, 0);
});

test('detalle: busca por id y responde null si no existe', () => {
  assert.equal(findDemoDocument('orden-examenes').kind, 'exam_order');
  assert.equal(findDemoDocument('no-existe'), null);
  assert.equal(findDemoDocument(undefined), null);
});
