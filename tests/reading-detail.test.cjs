/* global projectRequire, __dirname */
/**
 * Detalle de lectura: ruta con patientId, errores (403/404/temporal),
 * actualización acotada mientras está PENDING y vista de los tres estados.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const { installFakes, apiError } = require('./support/fakes.cjs');

installFakes();
const {
  createReadingDetail,
  classifyDetailError,
  describeConfirmationReason,
  PENDING_POLL,
} = projectRequire('src/modules/monitoring/application/reading-detail.ts');
const { Colors } = projectRequire('src/shared/presentation/theme.ts');
const { ReadingDetailView } = projectRequire('src/modules/monitoring/presentation/components/reading-detail-view.tsx');

const theme = Colors.light;

function reading(overrides = {}) {
  return {
    readingId: 'r1',
    patientId: 'p1',
    measuredAt: '2026-11-06T11:30:00.000Z',
    status: 'PENDING',
    confirmationReasons: [],
    context: null,
    source: 'mobile',
    recordedBy: 'p1',
    evaluation: null,
    measurements: [
      { measurementId: 'm1', parameterCode: 'SBP', value: 120, unit: 'mmHg', confirmedByUser: false },
      { measurementId: 'm2', parameterCode: 'DBP', value: 80, unit: 'mmHg', confirmedByUser: false },
    ],
    ...overrides,
  };
}

/** Reloj manual: las consultas automáticas solo corren al llamar tick(). */
function manualSchedule() {
  const timers = [];
  return {
    schedule: (run, ms) => {
      const timer = { run, ms, cancelled: false };
      timers.push(timer);
      return () => { timer.cancelled = true; };
    },
    pending: () => timers.filter((t) => !t.cancelled && !t.done),
    async tick() {
      const next = timers.find((t) => !t.cancelled && !t.done);
      assert.ok(next, 'no hay consulta programada');
      next.done = true;
      next.run();
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

const text = (element) =>
  renderToStaticMarkup(element).replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ');

test('pide la lectura con el patientId activo y el readingId de la navegación', async () => {
  const calls = [];
  const detail = createReadingDetail(async (patientId, readingId) => {
    calls.push([patientId, readingId]);
    return reading({ status: 'EVALUATED' });
  });
  await detail.open('p1', 'r1');
  assert.deepEqual(calls, [['p1', 'r1']]);
  assert.equal(detail.getState().reading.readingId, 'r1');
});

test('sin patientId o sin readingId no consulta y lo explica', async () => {
  let called = false;
  const detail = createReadingDetail(async () => { called = true; return reading(); });
  await detail.open(null, 'r1');
  assert.equal(called, false);
  assert.equal(detail.getState().error.kind, 'missing');
});

test('clasifica acceso denegado, lectura inexistente y error temporal', () => {
  assert.equal(classifyDetailError(apiError('FORBIDDEN', 403)).kind, 'forbidden');
  assert.equal(classifyDetailError(apiError('READING_NOT_FOUND', 404)).kind, 'not_found');
  assert.equal(classifyDetailError(apiError('SERVICE_UNAVAILABLE', 503)).kind, 'temporary');
  assert.equal(classifyDetailError(new TypeError('Network request failed')).kind, 'temporary');
});

test('sin respaldo: un error del servidor no muestra datos y se puede reintentar', async () => {
  let fail = true;
  const detail = createReadingDetail(async () => {
    if (fail) throw apiError('SERVICE_UNAVAILABLE', 503);
    return reading({ status: 'EVALUATED' });
  });
  await detail.open('p1', 'r1');
  assert.equal(detail.getState().reading, null);
  assert.equal(detail.getState().error.kind, 'temporary');
  fail = false;
  await detail.refresh();
  assert.equal(detail.getState().reading.status, 'EVALUATED');
  assert.equal(detail.getState().error, null);
});

test('una respuesta de otra lectura o de otro paciente se trata como inexistente', async () => {
  const detail = createReadingDetail(async () => reading({ readingId: 'otra' }));
  await detail.open('p1', 'r1');
  assert.equal(detail.getState().reading, null);
  assert.equal(detail.getState().error.kind, 'not_found');
});

test('PENDING se vuelve a consultar hasta ser evaluada', async () => {
  const clock = manualSchedule();
  const responses = [
    reading({ status: 'PENDING' }),
    reading({ status: 'PENDING' }),
    reading({
      status: 'EVALUATED',
      evaluation: { status: 'NORMAL', severity: 'BAJA', explanation: 'Bajo los umbrales.', evaluatedAt: '2026-11-06T11:31:00.000Z' },
    }),
  ];
  let calls = 0;
  const detail = createReadingDetail(async () => responses[Math.min(calls++, responses.length - 1)], {
    schedule: clock.schedule,
  });
  await detail.open('p1', 'r1');
  assert.equal(detail.getState().watching, true);
  await clock.tick();
  await clock.tick();
  const state = detail.getState();
  assert.equal(state.reading.status, 'EVALUATED');
  assert.equal(state.reading.evaluation.status, 'NORMAL');
  assert.equal(state.watching, false);
  assert.equal(clock.pending().length, 0, 'evaluada: no se programan más consultas');
});

test('el sondeo es acotado y "Actualizar" lo reinicia', async () => {
  const clock = manualSchedule();
  let calls = 0;
  const detail = createReadingDetail(async () => { calls++; return reading({ status: 'PENDING' }); }, {
    schedule: clock.schedule,
  });
  await detail.open('p1', 'r1');
  for (let i = 0; i < PENDING_POLL.maxChecks; i++) await clock.tick();
  assert.equal(calls, 1 + PENDING_POLL.maxChecks);
  assert.equal(detail.getState().pollExhausted, true);
  assert.equal(detail.getState().watching, false);
  assert.equal(clock.pending().length, 0, 'sin sondeo infinito');

  await detail.refresh();
  assert.equal(calls, 2 + PENDING_POLL.maxChecks);
  assert.equal(detail.getState().watching, true, 'actualizar manualmente reanuda las consultas');
  assert.equal(detail.getState().autoChecks, 0);
});

test('al salir de la pantalla se detienen las consultas automáticas', async () => {
  const clock = manualSchedule();
  const detail = createReadingDetail(async () => reading({ status: 'PENDING' }), { schedule: clock.schedule });
  await detail.open('p1', 'r1');
  assert.equal(clock.pending().length, 1);
  detail.dispose();
  assert.equal(clock.pending().length, 0);
});

test('REQUIRES_CONFIRMATION no se consulta automáticamente', async () => {
  const clock = manualSchedule();
  const detail = createReadingDetail(
    async () => reading({ status: 'REQUIRES_CONFIRMATION', confirmationReasons: ['UNUSUAL_VALUE:SBP'] }),
    { schedule: clock.schedule },
  );
  await detail.open('p1', 'r1');
  assert.equal(clock.pending().length, 0);
});

test('los motivos se describen sin diagnóstico y un código desconocido se muestra tal cual', () => {
  assert.match(describeConfirmationReason('UNUSUAL_VALUE:SBP'), /^Presión sistólica: el valor es muy distinto/);
  assert.match(describeConfirmationReason('SBP_NOT_GREATER_THAN_DBP'), /no es mayor que la diastólica/);
  assert.equal(describeConfirmationReason('OTRO_CODIGO'), 'OTRO_CODIGO');
});

test('la vista distingue pendiente, confirmación requerida y evaluada', () => {
  const base = { patientId: 'p1', readingId: 'r1', loading: false, refreshing: false, error: null, autoChecks: 0, watching: false, pollExhausted: false };
  const props = { theme, currentUserId: 'p1', onRefresh() {}, onConfirm() {}, onGoToHistory() {} };

  const pending = text(ReadingDetailView({ ...props, state: { ...base, watching: true, reading: reading() } }));
  assert.match(pending, /Pendiente de evaluación/);
  assert.match(pending, /asíncrona/);
  assert.match(pending, /Consultando de nuevo automáticamente \(1 de 6\)/);
  assert.match(pending, /Presión sistólica 120 mmHg/);
  assert.match(pending, /App móvil/);
  assert.match(pending, /Registrada por Tú/);

  const confirmTree = ReadingDetailView({
    ...props,
    state: { ...base, reading: reading({ status: 'REQUIRES_CONFIRMATION', confirmationReasons: ['UNUSUAL_VALUE:SBP'], measurements: [{ measurementId: 'm1', parameterCode: 'SBP', value: 200, unit: 'mmHg', confirmedByUser: false }] }) },
  });
  const confirmText = text(confirmTree);
  assert.match(confirmText, /Requiere tu confirmación/);
  assert.match(confirmText, /no son un diagnóstico/);
  assert.match(confirmText, /Presión sistólica: el valor es muy distinto/);
  assert.match(confirmText, /Revisar y confirmar/);
  assert.match(confirmText, /Se evaluará cuando se confirme/);

  const evaluated = text(ReadingDetailView({
    ...props,
    state: {
      ...base,
      reading: reading({
        status: 'EVALUATED',
        context: 'PREPRANDIAL',
        recordedBy: 'cuidador-1',
        measurements: [{ measurementId: 'g', parameterCode: 'GLUCOSE', value: 98.5, unit: 'mg/dL', confirmedByUser: true }],
        evaluation: { status: 'ADVERTENCIA', severity: 'MEDIA', explanation: 'Sobre el umbral configurado.', evaluatedAt: '2026-11-06T11:31:00.000Z' },
      }),
    },
  }));
  assert.match(evaluated, /Evaluada/);
  assert.match(evaluated, /Advertencia/);
  assert.match(evaluated, /Severidad Media/);
  assert.match(evaluated, /Sobre el umbral configurado/);
  assert.match(evaluated, /Glucosa Valor confirmado 98,5 mg\/dL/);
  assert.match(evaluated, /Antes de comer o en ayunas/);
  assert.match(evaluated, /Otra persona vinculada/);
});

test('la vista muestra cada error con su acción', () => {
  const base = { patientId: 'p1', readingId: 'r1', reading: null, loading: false, refreshing: false, autoChecks: 0, watching: false, pollExhausted: false };
  const props = { theme, currentUserId: 'p1', onRefresh() {}, onConfirm() {}, onGoToHistory() {} };
  const forbidden = text(ReadingDetailView({ ...props, state: { ...base, error: classifyDetailError(apiError('FORBIDDEN', 403)) } }));
  assert.match(forbidden, /Sin acceso a esta lectura/);
  assert.doesNotMatch(forbidden, /Reintentar/);
  const notFound = text(ReadingDetailView({ ...props, state: { ...base, error: classifyDetailError(apiError('READING_NOT_FOUND', 404)) } }));
  assert.match(notFound, /Lectura no encontrada/);
  assert.match(notFound, /Volver al historial/);
  const temporary = text(ReadingDetailView({ ...props, state: { ...base, error: classifyDetailError(apiError('X', 503)) } }));
  assert.match(temporary, /Reintentar/);
});

test('ningún archivo de la app llama a la ruta global /readings/{id}', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'mocks') walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        // Una ruta que empieza en /readings (sin /patients/{id} antes).
        if (/[`'"]\/readings[/`'"$]/.test(fs.readFileSync(full, 'utf8'))) offenders.push(path.relative(root, full));
      }
    }
  };
  for (const dir of ['app', 'src']) walk(path.join(root, dir));
  assert.deepEqual(offenders, []);
});
