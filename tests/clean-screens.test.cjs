const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const routes = {"app/perfil.tsx": "src/modules/identity/presentation/screens/profile-screen.tsx", "app/paciente-vinculado.tsx": "src/modules/identity/presentation/screens/linked-patient-screen.tsx", "app/(auth)/login.tsx": "src/modules/identity/presentation/screens/login-screen.tsx", "app/(auth)/professional-login.tsx": "src/modules/identity/presentation/screens/professional-login-screen.tsx", "app/(auth)/select-patient.tsx": "src/modules/relationships/presentation/screens/select-patient-screen.tsx", "app/(tabs)/vinculos.tsx": "src/modules/relationships/presentation/screens/links-screen.tsx", "app/invitacion.tsx": "src/modules/relationships/presentation/screens/invitation-screen.tsx", "app/registrar-medicion.tsx": "src/modules/monitoring/presentation/screens/register-measurement-screen.tsx", "app/historial.tsx": "src/modules/monitoring/presentation/screens/history-screen.tsx", "app/lectura/[readingId].tsx": "src/modules/monitoring/presentation/screens/reading-detail-screen.tsx", "app/(tabs)/graficos.tsx": "src/modules/monitoring/presentation/screens/charts-screen.tsx", "app/programas.tsx": "src/modules/monitoring/presentation/screens/programs-screen.tsx", "app/(tabs)/seguimiento.tsx": "src/modules/monitoring/presentation/screens/follow-up-screen.tsx", "app/(tabs)/menu.tsx": "src/modules/dashboard/presentation/screens/menu-screen.tsx", "app/(tabs)/atencion.tsx": "src/modules/medical-care/presentation/screens/medical-care-screen.tsx", "app/(tabs)/documentos/index.tsx": "src/modules/medical-care/presentation/screens/documents-screen.tsx", "app/(tabs)/documentos/[id].tsx": "src/modules/medical-care/presentation/screens/document-detail-screen.tsx"};
test('las rutas delegan en pantallas de presentación existentes', () => {
  for (const [route, screen] of Object.entries(routes)) {
    assert.equal(read(route).trim(), `export { default } from "@/${screen.slice(0,-4)}";`);
    assert.match(read(screen), /export default function/);
  }
});
test('documentos no inventa archivos y perfil usa el puerto de aplicación', () => {
  const docs = read('src/modules/medical-care/presentation/screens/documents-screen.tsx');
  assert.doesNotMatch(docs, /receta-medica|orden-examenes|DOCUMENTOS/);
  for (const name of ['profile-screen', 'linked-patient-screen']) {
    const screen = read(`src/modules/identity/presentation/screens/${name}.tsx`);
    assert.match(screen, /identity\/application\/identity-port/);
    assert.doesNotMatch(screen, /identity\/infrastructure/);
  }
});
