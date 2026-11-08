/* global projectRequire */
/**
 * Matriz de errores de los módulos conectados al backend:
 * historial, detalle de lectura, gráficos, alertas y notificaciones.
 * Para cada uno: 401, 403, 404 y fallo de red dejan un error visible y ningún
 * dato (ni simulado ni del paciente anterior); y el cambio de paciente (o de
 * usuario, en notificaciones) descarta lo anterior.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakes, apiError } = require('./support/fakes.cjs');

installFakes();
const { createReadingsHistory } = projectRequire('src/modules/monitoring/application/readings-history.ts');
const { createReadingDetail, classifyDetailError } = projectRequire('src/modules/monitoring/application/reading-detail.ts');
const { createMeasurementSeries } = projectRequire('src/modules/monitoring/application/measurement-series.ts');
const { createPatientAlerts, classifyAlertError } = projectRequire('src/modules/evaluation/application/patient-alerts.ts');
const { createNotificationsStore, classifyNotificationError } = projectRequire('src/modules/notifications/application/notifications.ts');

const ERRORS = {
  '401': () => apiError('AUTHENTICATION_REQUIRED', 401),
  '403': () => apiError('FORBIDDEN', 403),
  '404': () => apiError('RESOURCE_NOT_FOUND', 404),
  red: () => new TypeError('Network request failed'),
};

const NOW = new Date('2026-11-06T12:00:00.000Z');
const reading = (patientId) => ({
  readingId: `${patientId}-r1`, patientId, measuredAt: '2026-11-05T10:00:00.000Z', status: 'EVALUATED',
  confirmationReasons: [], measurements: [{ measurementId: 'm', parameterCode: 'WEIGHT', value: 70, unit: 'kg', confirmedByUser: false }],
});

/** Cada módulo: cómo crearlo, cómo abrir un paciente y cómo leer "datos" y "error". */
const MODULES = {
  historial: {
    create: (fetch) => createReadingsHistory((p) => fetch(p).then(() => ({ total: 1, page: 1, size: 20, items: [reading(p)] })), { now: () => NOW }),
    open: (m, p) => m.setPatient(p),
    data: (m) => m.getState().items.map((r) => r.patientId),
    error: (m) => m.getState().error,
  },
  detalle: {
    create: (fetch) => createReadingDetail((p) => fetch(p).then(() => reading(p))),
    open: (m, p) => m.open(p, `${p}-r1`),
    data: (m) => (m.getState().reading ? [m.getState().reading.patientId] : []),
    error: (m) => m.getState().error,
  },
  graficos: {
    create: (fetch) => createMeasurementSeries((p, q) => fetch(p).then(() => [{ readingId: `${p}-r1`, measuredAt: '2026-11-05T10:00:00.000Z', parameterCode: q.parameterCode, value: 1, unit: 'u' }]), { now: () => NOW }),
    open: (m, p) => m.setPatient(p),
    data: (m) => (m.getState().result ? [...new Set(m.getState().result.series.flatMap((s) => s.points.map((pt) => pt.readingId.split('-')[0])))] : []),
    error: (m) => m.getState().error,
  },
  alertas: {
    create: (fetch) => createPatientAlerts({
      list: (p) => fetch(p).then(() => [{ id: `${p}-a1`, readingId: null, ruleCode: 'X', severity: 'ALTA', explanation: '', status: 'OPEN', createdAt: '2026-11-05T10:00:00.000Z', readAt: null }]),
      markRead: async () => {},
    }, { now: () => NOW }),
    open: (m, p) => m.setPatient(p),
    data: (m) => m.getState().items.map((a) => a.id.split('-')[0]),
    error: (m) => m.getState().error,
  },
  notificaciones: {
    create: (fetch) => {
      const store = createNotificationsStore({ now: () => NOW });
      store.__fetch = fetch;
      return store;
    },
    // Las notificaciones son del usuario: "paciente" aquí es el usuario dueño.
    open: (m, owner) => m.setOwner(owner, {
      list: () => m.__fetch(owner).then(() => ({ total: 1, page: 1, size: 20, items: [{ id: `${owner}-n1`, type: '', title: '', body: '', status: 'sent', createdAt: '2026-11-05T10:00:00.000Z', readAt: null }] })),
      markRead: async () => {},
    }),
    data: (m) => m.getState().items.map((n) => n.id.split('-')[0]),
    error: (m) => m.getState().error,
  },
};

for (const [name, mod] of Object.entries(MODULES)) {
  for (const [label, makeError] of Object.entries(ERRORS)) {
    test(`${name}: ${label} deja un error visible y ningún dato`, async () => {
      const m = mod.create(() => Promise.reject(makeError()));
      await mod.open(m, 'pia');
      assert.ok(mod.error(m), 'debe haber error');
      assert.deepEqual(mod.data(m), [], 'sin datos simulados');
    });
  }

  test(`${name}: el cambio de paciente/usuario descarta los datos anteriores`, async () => {
    let failFor = null;
    const m = mod.create((p) => (p === failFor ? Promise.reject(ERRORS.red()) : Promise.resolve()));
    await mod.open(m, 'pia');
    assert.deepEqual(mod.data(m), ['pia']);
    failFor = 'rosa';
    await mod.open(m, 'rosa');
    assert.deepEqual(mod.data(m), [], 'no quedan datos de pía');
    assert.ok(mod.error(m));
  });
}

test('clasificación coherente de 401, 403, 404 y red en detalle, alertas y notificaciones', () => {
  const kinds = (classify) => Object.fromEntries(Object.entries(ERRORS).map(([k, make]) => [k, classify(make()).kind]));
  assert.deepEqual(kinds(classifyDetailError), { '401': 'session', '403': 'forbidden', '404': 'not_found', red: 'temporary' });
  assert.deepEqual(kinds(classifyAlertError), { '401': 'session', '403': 'forbidden', '404': 'not_found', red: 'network' });
  assert.deepEqual(kinds(classifyNotificationError), { '401': 'session', '403': 'forbidden', '404': 'not_found', red: 'network' });
});
