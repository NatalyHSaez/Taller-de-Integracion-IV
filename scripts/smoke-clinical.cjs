'use strict';
// Prueba de integracion local. Las escrituras requieren --write-demo.
// Los datos sinteticos se envian al backend real; no se simulan respuestas.
require('../tests/support/register.cjs');
// Los validadores de alertas/notificaciones comparten archivo con sus adaptadores.
// No se usa el transporte de Expo en esta prueba CLI: toda peticion usa fetch real.
mockModule('src/core/infrastructure/http/api-client.ts', { apiClient: {} });
const { checkReadingDetail } = projectRequire('src/modules/monitoring/application/use-cases/reading-detail.ts');
const { checkHistoryPage } = projectRequire('src/modules/monitoring/application/use-cases/readings-history.ts');
const { checkMeasurementSeries } = projectRequire('src/modules/monitoring/application/use-cases/measurement-series.ts');
const { checkAlertList } = projectRequire('src/modules/evaluation/infrastructure/api/alerts-api.ts');
const { checkNotificationPage } = projectRequire('src/modules/notifications/infrastructure/api/notifications-api.ts');
const { randomUUID } = require('node:crypto');
const base = 'http://localhost:8000/api/v1';
const patientId = '00000000-0000-4000-8000-00000000b001';
const otherId = '00000000-0000-4000-8000-00000000b002';
const caregiverId = '00000000-0000-4000-8000-00000000c001';
const root = `/patients/${patientId}`;
const sessions = [];
const created = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(condition, message) { if (!condition) throw new Error(message); }
function ok(message) { console.log('OK:', message); }
async function request(method, route, session, body, expected = 200, errorCode) {
  const response = await fetch(base + route, {
    method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json', 'X-Correlation-ID': randomUUID(),
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data;
  if (text) { try { data = JSON.parse(text); } catch { throw new Error(`${method} ${route}: respuesta no JSON (HTTP ${response.status})`); } }
  const code = typeof data?.errorCode === 'string' && /^[A-Z0-9_]+$/.test(data.errorCode) ? data.errorCode : '';
  check(response.status === expected, `${method} ${route}: HTTP ${response.status}, esperado ${expected}${code ? ' (' + code + ')' : ''}`);
  if (errorCode) check(code === errorCode, `${method} ${route}: codigo de error distinto de ${errorCode}`);
  if (expected === 204) check(!text, `${method} ${route}: cuerpo inesperado en HTTP 204`);
  return data;
}
async function login(email, password, id, role) {
  const session = await request('POST', '/auth/login', null, { email, password });
  check(typeof session?.accessToken === 'string' && !!session.accessToken && typeof session?.refreshToken === 'string' && !!session.refreshToken, 'Login sin tokens completos');
  sessions.push(session);
  const me = await request('GET', '/me', session);
  check(me?.id === id && Array.isArray(me.roles) && me.roles.includes(role), `Identidad demo inesperada (${role})`);
  return session;
}
async function poll(label, read, accept) {
  const deadline = Date.now() + 60000;
  do {
    const value = await read();
    if (accept(value)) return value;
    if (Date.now() >= deadline) break;
    await sleep(1000);
  } while (true);
  throw new Error(`${label}: no se completo en 60 segundos; revisar eventos y colas del backend`);
}
async function notifications(session) {
  const items = [];
  const seen = new Set();
  for (let page = 1; page <= 20; page++) {
    const data = checkNotificationPage(await request('GET', `/notifications?page=${page}&size=100`, session), page, 100);
    for (const item of data.items) {
      check(!seen.has(item.id), 'Paginacion de notificaciones cambio durante la consulta; repetir sin actividad concurrente');
      seen.add(item.id); items.push(item);
    }
    if (items.length >= data.total) return items;
    check(data.items.length > 0, 'Paginacion incompleta de notificaciones');
  }
  throw new Error('Mas de 2000 notificaciones; no es seguro correlacionar este ensayo');
}
const measurement = (parameterCode, value, unit) => ({ parameterCode, value, unit });
async function detail(session, id) {
  return checkReadingDetail(await request('GET', `${root}/readings/${id}`, session), patientId, id);
}
async function series(session, code) {
  return checkMeasurementSeries(await request('GET', `${root}/measurements?parameterCode=${code}`, session), code);
}
async function runReading({ label, measurements, context = null, expected, severity, author, authorId, forceConfirmation = false }) {
  const payload = { measuredAt: new Date().toISOString(), source: 'mobile', context, measurements };
  const raw = await request('POST', `${root}/readings`, author, payload, 201);
  check(typeof raw?.readingId === 'string' && !!raw.readingId, `${label}: lectura sin ID`);
  const id = raw.readingId;
  created.push({ label, id });
  console.log(`LECTURA CREADA: ${label} ${id}`);
  let reading = checkReadingDetail(raw, patientId, id);
  check(reading.recordedBy === authorId, `${label}: autor incorrecto`);
  check(reading.context === context, `${label}: contexto incorrecto`);
  console.log(`ESTADO INICIAL: ${reading.status}`);
  if (forceConfirmation) {
    check(reading.status === 'REQUIRES_CONFIRMATION' && reading.confirmationReasons.includes('SBP_NOT_GREATER_THAN_DBP'), `${label}: falta confirmacion por valores invertidos`);
  }
  let confirmed = false;
  if (reading.status === 'REQUIRES_CONFIRMATION') {
    check(reading.evaluation === null, 'Lectura sin confirmar tiene evaluacion');
    check((await detail(author, id)).status === 'REQUIRES_CONFIRMATION', 'La lectura no espera confirmacion');
    for (const m of measurements) check(!(await series(author, m.parameterCode)).some(x => x.readingId === id), 'Lectura sin confirmar aparece en serie');
    ok(`${label}: confirmacion requerida; excluida de series`);
    reading = checkReadingDetail(await request('POST', `${root}/readings/${id}/confirm`, author), patientId, id);
    check(['PENDING', 'EVALUATED'].includes(reading.status), 'Estado despues de confirmar incorrecto');
    check(reading.measurements.every(m => m.confirmedByUser), 'La confirmacion no persistio');
    confirmed = true;
    console.log(`ESTADO DESPUES DE CONFIRMAR: ${reading.status}`);
    await request('POST', `${root}/readings/${id}/confirm`, author, undefined, 409, 'READING_NOT_PENDING_CONFIRMATION');
    ok('Segunda confirmacion rechazada (409)');
  }
  check(['PENDING', 'EVALUATED'].includes(reading.status), 'Estado inesperado al procesar');
  reading = await poll(label, () => detail(author, id), r => r.status === 'EVALUATED');
  check(reading.recordedBy === authorId && reading.context === context, `${label}: autor/contexto no persistieron`);
  if (expected === null) check(reading.evaluation === null, `${label}: esperaba evaluacion nula`);
  else {
    check(reading.evaluation?.status === expected && reading.evaluation?.severity === severity, `${label}: resultado esperado ${expected}/${severity}, obtenido ${reading.evaluation?.status}/${reading.evaluation?.severity}`);
    check(typeof reading.evaluation.explanation === 'string' && !!reading.evaluation.explanation.trim(), `${label}: falta explicacion de nueva evaluacion`);
    check(Number.isFinite(Date.parse(reading.evaluation.evaluatedAt)), `${label}: falta fecha de evaluacion`);
  }
  for (const m of measurements) {
    const stored = reading.measurements.find(x => x.parameterCode === m.parameterCode);
    check(stored?.value === m.value && stored?.unit === m.unit && stored.confirmedByUser === confirmed, `${label}: medicion persistida distinta`);
    check((await series(author, m.parameterCode)).some(x => x.readingId === id && x.value === m.value && x.unit === m.unit), `${label}: lectura ausente en serie`);
  }
  ok(`${label}: EVALUATED / ${reading.evaluation?.status ?? 'sin resultado'} / ${reading.evaluation?.severity ?? 'sin severidad'}`);
  return reading;
}
async function main() {
  if (process.argv.includes('--check')) { ok('Validadores de la app cargados; sin peticiones ni escrituras'); return; }
  check(process.argv.includes('--write-demo'), 'Ejecutar con --write-demo solo en Docker local de desarrollo');
  const health = await request('GET', '/health');
  check(health?.status === 'ok' && ['acceso','clinico','notificaciones','auditoria'].every(s => health.servicios?.[s] === 'ok'), 'Gateway o servicios no disponibles');
  const patient = await login('paciente@demo.domicilia.cl', 'Demo-Paciente-2026', patientId, 'PATIENT');
  const caregiver = await login('cuidador@demo.domicilia.cl', 'Demo-Cuidador-2026', caregiverId, 'CAREGIVER');
  const other = await login('rosa@demo.domicilia.cl', 'Demo-Paciente-2026', otherId, 'PATIENT');
  check((await request('GET', `/patients/${otherId}`, other))?.id === otherId, 'Segundo paciente demo no comprobado');
  const linked = await request('GET', '/me/patients', caregiver);
  check(Array.isArray(linked) && !linked.some(x => x.patientId === otherId), 'El segundo paciente esta vinculado; no sirve como caso denegado');
  const relation = linked.find(x => x.patientId === patientId);
  check(['MEASUREMENT_CREATE','MEASUREMENT_VIEW','ALERT_VIEW'].every(p => relation?.permissions?.includes(p)), 'Cuidador sin permisos necesarios');
  await request('GET', `/patients/${otherId}/readings?page=1&size=1`, caregiver, undefined, 403, 'FORBIDDEN');
  await request('GET', `/patients/${otherId}/conditions`, caregiver, undefined, 403, 'FORBIDDEN');
  const conditions = await request('GET', `${root}/conditions`, patient);
  check(Array.isArray(conditions) && ['HTA','DM2'].every(code => conditions.some(x => x.conditionCode === code && x.status === 'active')), 'Paciente demo sin HTA y DM2 activas');
  ok('Identidades demo, condiciones y permisos; paciente existente no vinculado rechazado');
  const beforePatient = new Set((await notifications(patient)).map(x => x.id));
  const beforeCaregiver = new Set((await notifications(caregiver)).map(x => x.id));
  const start = new Date().toISOString();
  const p = { author: patient, authorId: patientId };
  const c = { author: caregiver, authorId: caregiverId };
  await runReading({ ...p, label:'HTA normal', measurements:[measurement('SBP',120,'mmHg'),measurement('DBP',80,'mmHg')], expected:'NORMAL', severity:'BAJA' });
  await runReading({ ...p, label:'DM2 preprandial', measurements:[measurement('GLUCOSE',150,'mg/dL')], context:'PREPRANDIAL', expected:'ADVERTENCIA', severity:'MEDIA' });
  await runReading({ ...c, label:'DM2 postprandial por cuidador', measurements:[measurement('GLUCOSE',150,'mg/dL')], context:'POSTPRANDIAL', expected:'NORMAL', severity:'BAJA' });
  await runReading({ ...p, label:'Peso', measurements:[measurement('WEIGHT',81,'kg')], expected:null });
  const alertReading = await runReading({ ...p, label:'HTA invertida confirmada', measurements:[measurement('SBP',90,'mmHg'),measurement('DBP',105,'mmHg')], expected:'ALERTA', severity:'ALTA', forceConfirmation:true });
  for (const session of [patient, caregiver]) {
    const history = checkHistoryPage(await request('GET', `${root}/readings?page=1&size=100&from=${encodeURIComponent(start)}`, session), patientId, 1);
    for (const record of created) {
      check(history.items.some(x => x.readingId === record.id && x.status === 'EVALUATED'), `Lectura ausente en historial: ${record.label}`);
      check((await detail(session, record.id)).status === 'EVALUATED', `Detalle no evaluado: ${record.label}`);
    }
  }
  ok('Cinco lecturas persistidas en historial y detalle para ambos roles');
  const alerts = async (session, status) => checkAlertList(await request('GET', `${root}/alerts${status ? '?status='+status : ''}`, session), status);
  const found = await poll('Alerta HTA', () => alerts(patient,'OPEN'), rows => rows.some(x => x.readingId === alertReading.readingId));
  const alert = found.find(x => x.readingId === alertReading.readingId);
  check(alert.ruleCode === 'HTA_ALERT' && alert.severity === 'ALTA' && alert.explanation === alertReading.evaluation.explanation && alert.readAt === null, 'Alerta no coincide con evaluacion');
  check((await alerts(caregiver,'OPEN')).some(x => x.id === alert.id), 'Cuidador no ve alerta autorizada');
  ok(`Alerta generada y consultada por ambos roles: ${alert.id}`);
  // NotificationOut no expone sourceEventId ni readingId. Correlacion conservadora
  // por ID nuevo, tipo, texto y ausencia de actividad concurrente.
  async function newNotification(session, before, role) {
    const matches = rows => rows.filter(x => !before.has(x.id) && x.type === 'ALERT' && x.body === alert.explanation && x.status !== 'read' && Date.parse(x.createdAt) >= Date.parse(start) - 5000);
    const rows = await poll(`Notificacion ${role}`, () => notifications(session), list => matches(list).length > 0);
    const candidates = matches(rows);
    check(candidates.length === 1, `Notificacion ${role} ambigua; no se marcara ninguna`);
    return candidates[0];
  }
  const pn = await newNotification(patient,beforePatient,'paciente');
  const cn = await newNotification(caregiver,beforeCaregiver,'cuidador');
  check(pn.id !== cn.id, 'Notificaciones no independientes');
  ok('Notificaciones internas nuevas de paciente y cuidador, correlacionadas por texto e ID nuevo');
  await request('POST', `${root}/alerts/${alert.id}/read`, patient, undefined, 204);
  check((await alerts(patient,'READ')).some(x => x.id === alert.id && x.readAt !== null), 'Alerta no marcada como leida');
  for (const [session, item] of [[patient,pn],[caregiver,cn]]) {
    await request('POST', `/notifications/${item.id}/read`, session, undefined, 204);
    check((await notifications(session)).some(x => x.id === item.id && x.status === 'read' && x.readAt !== null), 'Notificacion no marcada como leida');
  }
  ok('Marcado y persistencia de lectura de alerta y dos notificaciones');
  console.log('GRUPO 8: FLUJO HTTP Y VALIDADORES APROBADOS');
}
(async () => {
  try { await main(); }
  catch (error) { console.error('ERROR GRUPO 8:', error?.message ?? 'Error desconocido'); process.exitCode = 1; }
  finally {
    for (const session of sessions) {
      try { await request('POST','/auth/logout',null,{ refreshToken:session.refreshToken },204); }
      catch { console.error('ERROR: no se pudo cerrar una sesion de prueba'); process.exitCode = 1; }
    }
    if (sessions.length) console.log('Sesiones de prueba: cierre solicitado.');
    console.log('Lecturas creadas en BD (no se eliminan):', created.length);
    for (const row of created) console.log(`${row.label}: ${row.id}`);
  }
})();
