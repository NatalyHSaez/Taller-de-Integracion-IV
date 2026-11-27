/* global projectRequire, __dirname */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r/g, '');

test('TI4-81: Expo ejecuta las pantallas reales de cuenta y vínculos', () => {
  assert.equal(read('app/perfil.tsx').trim(),
    'export { default } from "@/src/modules/identity/presentation/screens/profile-screen";');
  assert.equal(read('app/configuracion.tsx').trim(),
    'export { default } from "@/composition/routes/settings-route";');
  assert.equal(read('app/(tabs)/vinculos.tsx').trim(),
    'export { default } from "@/src/modules/relationships/presentation/screens/links-screen";');
  assert.equal(read('app/(auth)/login.tsx').trim(),
    'export { default } from "@/composition/routes/login-route";');

  for (const file of [
    'src/modules/identity/presentation/screens/profile-screen.tsx',
    'src/modules/identity/presentation/screens/settings-screen.tsx',
    'src/modules/relationships/presentation/screens/links-screen.tsx',
  ]) {
    assert.doesNotMatch(read(file), /modules\/demo|useDemo|demo-store/);
  }
});

test('TI4-81: roles y estados profesionales se presentan en español', () => {
  const { formatDoctorStatus, formatUserRoles } = projectRequire(
    'src/modules/identity/application/use-cases/profile.ts',
  );
  assert.equal(formatUserRoles(['PATIENT', 'CAREGIVER', 'DOCTOR']),
    'Paciente · Cuidador · Médico');
  assert.equal(formatDoctorStatus('VERIFIED'), 'Verificado');
  assert.equal(formatDoctorStatus('PENDING'), 'Pendiente de verificación');
  assert.equal(formatDoctorStatus('REJECTED'), 'Verificación rechazada');
});

test('TI4-81: la UI deja correo y RUT de solo lectura y explica la expiración', () => {
  const profile = read('src/modules/identity/presentation/screens/profile-screen.tsx');
  assert.match(profile, /label="Correo electrónico"[\s\S]*?editable=\{false\}/);
  assert.match(profile, /label="RUT"/);
  assert.match(profile, /RUT y los demás datos de identidad son de solo lectura/);

  const login = read('src/modules/identity/presentation/screens/login-screen.tsx');
  assert.match(login, /Sesión expirada\. Vuelve a iniciar sesión\./);
  assert.match(read('composition/configure/configure-identity.ts'), /expired: expireLocalSession/);
});
