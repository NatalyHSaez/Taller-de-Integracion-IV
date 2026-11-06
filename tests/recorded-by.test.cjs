/* global projectRequire */
/** "Registrada por": nombre del cuidador vinculado (o del paciente / médico) en el detalle de la lectura. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const { installFakes } = require('./support/fakes.cjs');

installFakes();
const { describeRecordedBy, createLinkedPeopleLoader } = projectRequire('services/recorded-by.ts');
const { ReadingDetailView } = projectRequire('components/readings/reading-detail-view.tsx');
const { Colors } = projectRequire('constants/theme.ts');

const person = (userId, fullName) => ({ relationshipId: `rel-${userId}`, userId, fullName, permissions: [], linkedAt: '' });
const people = { caregivers: [person('cui-1', 'Ana Pérez')], doctors: [person('doc-1', 'Dr. Soto')] };
const patient = { id: 'pia', fullName: 'Pía Rojas', isPatient: true };
const caregiver = { id: 'cui-1', fullName: 'Ana Pérez', isPatient: false };

test('el paciente ve el nombre del cuidador que registró', () => {
  assert.equal(describeRecordedBy({ recordedBy: 'cui-1', patientId: 'pia', viewer: patient, people }), 'Ana Pérez (cuidador vinculado)');
  assert.equal(describeRecordedBy({ recordedBy: 'doc-1', patientId: 'pia', viewer: patient, people }), 'Dr. Soto (médico vinculado)');
  assert.equal(describeRecordedBy({ recordedBy: 'pia', patientId: 'pia', viewer: patient, people }), 'Tú');
});

test('el cuidador ve su propio nombre y el del paciente', () => {
  assert.equal(describeRecordedBy({ recordedBy: 'cui-1', patientId: 'pia', viewer: caregiver }), 'Ana Pérez (tú, como cuidador)');
  assert.equal(describeRecordedBy({ recordedBy: 'pia', patientId: 'pia', patientName: 'Pía Rojas', viewer: caregiver }), 'Pía Rojas (paciente)');
  assert.equal(describeRecordedBy({ recordedBy: 'otro', patientId: 'pia', viewer: caregiver }), 'Otra persona vinculada al paciente');
});

test('sin datos no inventa nombres', () => {
  assert.equal(describeRecordedBy({ recordedBy: null, patientId: 'pia', viewer: patient, people }), null);
  assert.equal(describeRecordedBy({ recordedBy: 'cui-revocado', patientId: 'pia', viewer: patient, people }), 'Otra persona vinculada al paciente');
  assert.equal(describeRecordedBy({ recordedBy: 'pia', patientId: 'pia', viewer: caregiver }), 'El paciente');
});

test('carga los vínculos del paciente una vez (caché) y reintenta si falla', async () => {
  let calls = 0;
  let fail = true;
  const loader = createLinkedPeopleLoader(
    async () => { calls += 1; if (fail) throw new Error('red'); return people.caregivers; },
    async () => people.doctors,
  );
  await assert.rejects(loader.load('pia'));
  fail = false;
  const first = await loader.load('pia');
  await loader.load('pia');
  assert.equal(first.caregivers[0].fullName, 'Ana Pérez');
  assert.equal(calls, 2, 'el error no queda en caché y el acierto sí');
});

test('el detalle muestra "Registrada por" con el nombre en Datos del registro', () => {
  const reading = {
    readingId: 'r1', patientId: 'pia', measuredAt: '2026-11-06T10:00:00.000Z', status: 'EVALUATED', confirmationReasons: [],
    context: null, source: 'mobile', recordedBy: 'cui-1', evaluation: null,
    measurements: [{ measurementId: 'm', parameterCode: 'WEIGHT', value: 70, unit: 'kg', confirmedByUser: false }],
  };
  const state = { patientId: 'pia', readingId: 'r1', reading, loading: false, refreshing: false, error: null, polling: false, pollGaveUp: false };
  const html = renderToStaticMarkup(ReadingDetailView({
    state, theme: Colors.light, currentUserId: 'pia', recordedByLabel: 'Ana Pérez (cuidador vinculado)',
    onRefresh() {}, onConfirm() {}, onGoToHistory() {},
  })).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(html, /Datos del registro/);
  assert.match(html, /Registrada por Ana Pérez \(cuidador vinculado\)/);
});
