/* global projectRequire */
/**
 * Flujo visual principal del modal de confirmación y del resultado.
 * Renderiza los componentes con react-dom/server + react-native-web y pulsa
 * sus botones recorriendo el árbol de elementos.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const { installFakes } = require('./support/fakes.cjs');

const fakes = installFakes();
const { Colors } = projectRequire('constants/theme.ts');
const { readingsService } = projectRequire('services/readings.ts');
const { createReadingFlow } = projectRequire('services/reading-flow.ts');
const { ReadingConfirmationContent } = projectRequire('components/readings/reading-confirmation.tsx');
const { ReadingResult } = projectRequire('components/readings/reading-result.tsx');

const theme = Colors.light;
const PATIENT = fakes.userId;
const REASONS = ['Motivo informado <A>', 'Otro motivo del servicio'];
const SUMMARY = '185 / 95 mmHg · 88 bpm';
const REQUEST = {
  measuredAt: '2026-01-15T08:30:00-03:00',
  source: 'mobile',
  measurements: [{ parameterCode: 'SBP', value: 185, unit: 'mmHg' }, { parameterCode: 'DBP', value: 95, unit: 'mmHg' }],
};

/** Texto visible (sin etiquetas HTML). */
function textOf(element) {
  return renderToStaticMarkup(element)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/** Busca un botón por su etiqueta de accesibilidad (o "label") en el árbol. */
function findButton(element, label) {
  if (!element || typeof element !== 'object') return null;
  if (Array.isArray(element)) {
    for (const child of element) {
      const found = findButton(child, label);
      if (found) return found;
    }
    return null;
  }
  const props = element.props ?? {};
  if ((props.accessibilityLabel ?? props.label) === label && typeof props.onPress === 'function') return props;
  return findButton(props.children, label);
}

function press(tree, label) {
  const button = findButton(tree, label);
  assert.ok(button, `No se encontró el botón "${label}"`);
  return button.onPress();
}

const confirmCalls = () => fakes.calls.post.filter((call) => call.path.endsWith('/confirm'));

function views(flow, history) {
  const state = flow.getState();
  const common = { summary: SUMMARY, theme, onGoToHistory: () => history.push('historial') };
  if (state.step === 'confirming') {
    return ReadingConfirmationContent({
      ...common, reading: state.reading, busy: state.busy, error: state.error,
      onConfirm: flow.confirm, onCancel: flow.cancel, onRefresh: flow.refresh,
    });
  }
  if (state.step === 'result' || state.step === 'unconfirmed') {
    return ReadingResult({
      ...common, reading: state.reading, unconfirmed: state.step === 'unconfirmed',
      refreshing: state.step === 'result' && state.refreshing,
      refreshError: state.step === 'result' ? state.refreshError : null,
      onRefresh: flow.refresh, onConfirmNow: flow.reopen, onNewReading: flow.reset,
    });
  }
  return null;
}

test('modal → cancelar → confirmar → resultado pendiente', async () => {
  const history = [];
  const flow = createReadingFlow(readingsService);
  fakes.replyPost({ readingId: 'r-ui', status: 'REQUIRES_CONFIRMATION', confirmationReasons: REASONS });
  await flow.submit(PATIENT, REQUEST);

  // Modal: motivos tal cual, valores ingresados y aviso de que no es diagnóstico.
  let tree = views(flow, history);
  let text = textOf(tree);
  for (const reason of REASONS) assert.ok(text.includes(reason), `falta el motivo "${reason}"`);
  assert.ok(text.includes(SUMMARY));
  assert.match(text, /no es un diagnóstico/);
  assert.doesNotMatch(text, /tienes (hipertensión|diabetes)|diagnosticad/i);

  // Cancelar: no llama a /confirm y explica que no se evaluará.
  press(tree, 'Cancelar sin confirmar');
  assert.equal(confirmCalls().length, 0);
  tree = views(flow, history);
  text = textOf(tree);
  assert.match(text, /Lectura sin confirmar/);
  assert.match(text, /no la evaluará hasta que confirmes/);

  // Volver a revisar y confirmar conscientemente.
  press(tree, 'Confirmar ahora');
  tree = views(flow, history);
  fakes.replyPost({ readingId: 'r-ui', status: 'PENDING' });
  await press(tree, 'Confirmar lectura');
  assert.equal(confirmCalls().length, 1);
  assert.equal(confirmCalls()[0].path, `/patients/${PATIENT}/readings/r-ui/confirm`);

  // Resultado: PENDING con explicación asíncrona y acciones disponibles.
  tree = views(flow, history);
  text = textOf(tree);
  assert.match(text, /Pendiente de evaluación/);
  assert.match(text, /forma asíncrona/);
  assert.ok(findButton(tree, 'Actualizar estado'));
  press(tree, 'Ir al historial');
  assert.deepEqual(history, ['historial']);

  fakes.replyGet({ readingId: 'r-ui', status: 'EVALUATED' });
  await press(tree, 'Actualizar estado');
  assert.match(textOf(views(flow, history)), /Evaluada/);
});

test('errores de confirmación ofrecen la acción adecuada', () => {
  const reading = { patientId: PATIENT, readingId: 'r-x', status: 'REQUIRES_CONFIRMATION', reasons: [] };
  const base = { reading, summary: SUMMARY, busy: false, theme, onConfirm() {}, onCancel() {}, onRefresh() {}, onGoToHistory() {} };

  const notFound = ReadingConfirmationContent({ ...base, error: { kind: 'not_found', message: 'No encontramos esta lectura' } });
  assert.match(textOf(notFound), /No encontramos esta lectura/);
  assert.ok(findButton(notFound, 'Ir al historial'));

  const notPending = ReadingConfirmationContent({ ...base, error: { kind: 'not_pending', message: 'ya no está esperando confirmación' } });
  assert.ok(findButton(notPending, 'Actualizar estado'));
  assert.match(textOf(notPending), /El servicio no informó motivos/);
});

test('mientras confirma, el botón queda deshabilitado', () => {
  const reading = { patientId: PATIENT, readingId: 'r-y', status: 'REQUIRES_CONFIRMATION', reasons: ['M'] };
  const tree = ReadingConfirmationContent({
    reading, summary: SUMMARY, busy: true, error: null, theme,
    onConfirm() {}, onCancel() {}, onRefresh() {}, onGoToHistory() {},
  });
  assert.equal(findButton(tree, 'Confirmar lectura').disabled, true);
  assert.equal(findButton(tree, 'Cancelar sin confirmar').disabled, true);
});
