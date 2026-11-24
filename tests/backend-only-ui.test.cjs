const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
function tsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? tsFiles(file) : /\.tsx?$/.test(entry.name) ? [file] : [];
  });
}

test('solo existe autenticación real; no hay pantalla de demostración', () => {
  const auth = read('src', 'modules', 'identity', 'application', 'authservice.ts');
  const login = read('src', 'modules', 'identity', 'presentation', 'screens', 'login-screen.tsx');
  assert.match(auth, /loginWithBackend\(email, password\)/);
  assert.doesNotMatch(auth, /loginWithMock|startMock|demo\.login|mockApi/);
  assert.doesNotMatch(login, /modo demo|modo demostraci[oó]n|iniciar demostraci[oó]n|startMock/i);
  assert.equal(fs.existsSync(path.join(root, 'app', 'demo.tsx')), false);
});

test('ninguna pantalla consulta el almacén de datos simulados', () => {
  for (const file of [...tsFiles(path.join(root, 'app')), ...tsFiles(path.join(root, 'src', 'modules')).filter(file => file.includes(`${path.sep}presentation${path.sep}screens${path.sep}`))]) {
    const code = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(code, /modules\/demo|notifications-demo|demo-alerts|useDemo\(|mockApi\./,
      `El archivo ${path.relative(root, file)} aún consulta mocks`);
  }
  const notificationsHook = read('src', 'modules', 'notifications', 'presentation', 'hooks', 'use-notifications.ts');
  assert.doesNotMatch(notificationsHook, /notifications-demo|demoNotificationsApi/);
});

test('historial muestra presión, glucosa y peso; no presenta pulso', () => {
  const history = read('src', 'modules', 'monitoring', 'presentation', 'screens', 'history-screen.tsx');
  const card = read('src', 'modules', 'monitoring', 'presentation', 'components', 'reading-history-item.tsx');
  assert.match(history, /label: "Presión"/);
  assert.match(history, /label: "Glucosa"/);
  assert.match(history, /label: "Peso"/);
  assert.doesNotMatch(history, /label: "Pulso"/);
  assert.match(card, /item\.parameterCode === 'HEART_RATE'\) continue/);
});

test('notificaciones solo muestran Leídas y No leídas', () => {
  const view = read('src', 'modules', 'notifications', 'presentation', 'components', 'notifications-view.tsx');
  const screen = read('src', 'modules', 'notifications', 'presentation', 'screens', 'notifications-screen.tsx');
  for (const source of [view, screen]) {
    assert.match(source, /No leídas/);
    assert.match(source, /Leídas/);
    assert.doesNotMatch(source, /label: ['"]Pendientes['"]|label: ['"]Enviadas['"]/);
  }
  const hook = read('src', 'modules', 'notifications', 'presentation', 'hooks', 'use-notifications.ts');
  assert.match(hook, /selectNotificationOwner/);
  assert.doesNotMatch(hook, /infrastructure\//);
  const composition = read('composition', 'configure-notifications.ts');
  assert.match(composition, /configureNotifications\(backendNotificationsApi\)/);
  assert.doesNotMatch(hook, /demoNotificationsApi/);
});
