/* global projectRequire, __dirname */
/** Vínculos: formatos de fecha, permisos e id, y lo agregado a la pantalla de Martín. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { installFakes } = require('./support/fakes.cjs');

installFakes();
const { describePermissions, formatLinkedAt, shortRelationshipId } = projectRequire('src/modules/relationships/presentation/link-format.ts');
const source = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'modules', 'relationships', 'presentation', 'screens', 'links-screen.tsx'), 'utf8').replace(/\r/g, '');

test('formatos: permisos, fecha de vinculación e identificador', () => {
  assert.equal(describePermissions(['MEASUREMENT_VIEW', 'ALERT_VIEW']), 'consultar mediciones, consultar alertas');
  assert.equal(describePermissions([]), 'ninguno');
  assert.equal(describePermissions(['NUEVO']), 'NUEVO');
  assert.match(formatLinkedAt('2026-11-01T15:00:00.000Z'), /noviembre de 2026/);
  assert.equal(formatLinkedAt(null), null);
  assert.equal(formatLinkedAt('no es fecha'), null);
  assert.equal(shortRelationshipId('3b5bce00-f1aa-4c2b-9d1e-000000000000'), '3b5bce00');
});

test('cuidadores y médicos muestran fecha, permisos y vínculo', () => {
  assert.match(source, /<Copy>\{caregiver\.fullName\}<\/Copy>\n\s*<LinkDetails link=\{caregiver\} \/>/);
  assert.match(source, /<Copy>\{doctor\.fullName\}<\/Copy>\n\s*<LinkDetails link=\{doctor\} \/>/);
});

test('actualización manual, al volver a la pestaña y reintento', () => {
  assert.match(source, /Actualizar vínculos/);
  assert.match(source, /label="Reintentar"/);
  assert.match(source, /useIsFocused\(\)/);
  assert.match(source, /await refreshRealLinks\(\)/, 'reutiliza la recarga de Martín');
});

test('administración solo para el paciente y sin datos simulados en la sesión backend', () => {
  // La pantalla consulta vínculos al Gateway y nunca importa datos falsos.
  assert.match(source, /getPatientCaregivers\(patientId\)/);
  assert.match(source, /getPatientDoctors\(patientId\)/);
  assert.match(source, /user\?\.role\s*===\s*['"]patient['"]/);
  assert.match(source, /RealCaregiverCard/);
  assert.match(source, /RealDoctorCard/);
  assert.doesNotMatch(source, /RequestCard|useDemo|demo\.|MockInvitationScreen/);
});
