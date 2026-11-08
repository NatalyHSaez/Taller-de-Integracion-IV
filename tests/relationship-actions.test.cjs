/* global projectRequire, mockModule, __dirname */
/**
 * Permisos y desvinculación: PUT reemplaza con el conjunto completo, DELETE 204,
 * errores RELATIONSHIP_NOT_FOUND / RELATIONSHIP_REVOKED / UNKNOWN_PERMISSION,
 * confirmación (cancelar no revoca) y el cuidador que deja el vínculo.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { ApiError } = projectRequire('src/core/infrastructure/http/errors/index.ts');
const apiError = (code, status) => new ApiError({ code, status, message: `backend ${code}` });

/** Backend simulado con la lógica de relaciones/rutas.py. */
const db = new Map();
const calls = [];
function resetDb() {
  db.clear();
  calls.length = 0;
  db.set('rel-1', { patientId: 'pia', caregiver: 'yo', status: 'active', permissions: ['MEASUREMENT_VIEW'] });
  db.set('rel-doc', { patientId: 'pia', status: 'active' });
}
const KNOWN = new Set(['PATIENT_PROFILE_VIEW', 'MEASUREMENT_CREATE', 'MEASUREMENT_VIEW', 'ALERT_VIEW']);
function active(id) {
  const row = db.get(id);
  if (!row) throw apiError('RELATIONSHIP_NOT_FOUND', 404);
  if (row.status !== 'active') throw apiError('RELATIONSHIP_REVOKED', 409);
  return row;
}

mockModule('src/modules/relationships/infrastructure/relationships-api.ts', {
  async updateCaregiverPermissions(id, permissions) {
    calls.push(['PUT', id, permissions]);
    const row = active(id);
    if (permissions.some((p) => !KNOWN.has(p))) throw apiError('UNKNOWN_PERMISSION', 422);
    row.permissions = [...permissions]; // reemplaza, no agrega
    return { relationshipId: id, userId: 'yo', fullName: 'Yo', permissions: row.permissions, linkedAt: '2026-11-01T00:00:00Z' };
  },
  async revokeCaregiverRelationship(id) {
    calls.push(['DELETE', id]);
    active(id).status = 'revoked';
  },
  async revokeDoctorRelationship(id) {
    calls.push(['DELETE-doc', id]);
    active(id).status = 'revoked';
  },
  async getMePatients() {
    return [...db.entries()]
      .filter(([, row]) => row.caregiver === 'yo' && row.status === 'active')
      .map(([relationshipId, row]) => ({
        patientId: row.patientId, fullName: 'Pía', relationshipId, relationshipType: 'CAREGIVER', permissions: row.permissions, linkedAt: '',
      }));
  },
});

const actions = {
  ...projectRequire('src/modules/relationships/application/relationship-actions.ts'),
  ...projectRequire('src/modules/relationships/presentation/confirm-dialog.ts'),
};

test('PUT envía el conjunto completo y reemplaza; los permisos sobreviven al volver a consultar', async () => {
  resetDb();
  await actions.updateCaregiverPermissions('rel-1', ['PATIENT_PROFILE_VIEW', 'ALERT_VIEW', 'ALERT_VIEW']);
  assert.deepEqual(calls[0], ['PUT', 'rel-1', ['PATIENT_PROFILE_VIEW', 'ALERT_VIEW']]);
  assert.deepEqual(db.get('rel-1').permissions, ['PATIENT_PROFILE_VIEW', 'ALERT_VIEW'], 'MEASUREMENT_VIEW ya no está');
  const [mine] = await projectRequire('src/modules/relationships/infrastructure/relationships-api.ts').getMePatients();
  assert.deepEqual(mine.permissions, ['PATIENT_PROFILE_VIEW', 'ALERT_VIEW']);
});

test('UNKNOWN_PERMISSION da un mensaje claro y no marca el vínculo como obsoleto', async () => {
  resetDb();
  let stale = 0;
  const off = actions.onStaleRelationship(() => { stale += 1; });
  await assert.rejects(actions.updateCaregiverPermissions('rel-1', ['NUEVO']), /permisos no es válido/);
  assert.equal(stale, 0);
  off();
});

test('guardar permisos de un vínculo inexistente o revocado avisa para recargar la lista', async () => {
  resetDb();
  let stale = 0;
  const off = actions.onStaleRelationship(() => { stale += 1; });
  await assert.rejects(actions.updateCaregiverPermissions('no-existe', []), /ya no existe/);
  db.get('rel-1').status = 'revoked';
  await assert.rejects(actions.updateCaregiverPermissions('rel-1', []), /ya estaba revocado/);
  assert.equal(stale, 2);
  off();
});

test('revocar: 204 sin cuerpo; si ya no existe o ya estaba revocado cuenta como logrado', async () => {
  resetDb();
  assert.equal(await actions.revokeCaregiverRelationship('rel-1'), undefined);
  assert.equal(db.get('rel-1').status, 'revoked');
  await actions.revokeCaregiverRelationship('rel-1'); // RELATIONSHIP_REVOKED
  await actions.revokeDoctorRelationship('no-existe'); // RELATIONSHIP_NOT_FOUND
  await actions.revokeDoctorRelationship('rel-doc');
  assert.equal(db.get('rel-doc').status, 'revoked');
});

test('otros errores al revocar se informan con un mensaje claro', async () => {
  const info = actions.describeRelationshipError(apiError('FORBIDDEN', 403));
  assert.match(info.message, /No tienes permiso/);
  assert.equal(info.stale, false);
  assert.match(actions.describeRelationshipError(new TypeError('Network request failed')).message, /conexión/);
  assert.equal(actions.describeRelationshipError(apiError('RELATIONSHIP_NOT_FOUND', 404)).stale, true);
  assert.equal(actions.describeRelationshipError(apiError('RELATIONSHIP_REVOKED', 409)).stale, true);
});

test('el cuidador deja su vínculo: busca su relationshipId y lo revoca', async () => {
  resetDb();
  await actions.leaveCaregiverRelationship('pia');
  assert.deepEqual(calls.at(-1), ['DELETE', 'rel-1']);
  assert.deepEqual(await projectRequire('src/modules/relationships/infrastructure/relationships-api.ts').getMePatients(), [], 'ya no aparece en su lista');
  await actions.leaveCaregiverRelationship('pia'); // ya no hay vínculo: no falla
});

test('confirmación en la web: cancelar no revoca, aceptar sí', async () => {
  const answers = [];
  globalThis.window = { confirm: () => answers.shift(), alert() {} };
  answers.push(false);
  assert.equal(await actions.confirmAction({ title: 'Retirar acceso', message: '¿Seguro?', confirmLabel: 'Revocar' }), false);
  answers.push(true);
  assert.equal(await actions.confirmAction({ title: 'Retirar acceso', message: '¿Seguro?', confirmLabel: 'Revocar' }), true);

  // El Alert con botones de Martín: Cancelar no ejecuta la acción.
  let revoked = 0;
  const buttons = [{ text: 'Cancelar', style: 'cancel' }, { text: 'Revocar acceso', style: 'destructive', onPress: () => { revoked += 1; } }];
  answers.push(false);
  actions.Alert.alert('Retirar acceso', '¿Seguro?', buttons);
  assert.equal(revoked, 0);
  answers.push(true);
  actions.Alert.alert('Retirar acceso', '¿Seguro?', buttons);
  assert.equal(revoked, 1);
  delete globalThis.window;
});

test('las pantallas usan estas funciones y agregan "Dejar de acompañar"', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const read = (...p) => fs.readFileSync(path.resolve(__dirname, '..', ...p), 'utf8').replace(/\r/g, '');
  const links = read('app', '(tabs)', 'vinculos.tsx');
  assert.match(links, /from '@\/src\/modules\/relationships\/application\/relationship-actions'/);
  assert.doesNotMatch(links, /import \{[^}]*\bAlert\b[^}]*\} from 'react-native'/);
  assert.match(links, /onStaleRelationship/);
  const select = read('app', '(auth)', 'select-patient.tsx');
  assert.match(select, /<LeavePatientAction/);
  assert.match(select, /onLeft=\{\(\) => appState\.loadRealPatients\(\)\}/);
});
