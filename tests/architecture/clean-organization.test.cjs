const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const exists = file => fs.existsSync(path.join(root, file));
const files = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => entry.name);

test('organización: contratos de seguimiento y cuenta pertenecen a sus módulos; Core solo conserva los transversales', () => {
  for (const file of [
    'src/modules/monitoring/domain/contracts/reading.ts',
    'src/modules/monitoring/domain/contracts/clinical-parameter.ts',
    'src/modules/monitoring/infrastructure/dto/reading.ts',
    'src/modules/identity/domain/account-requests.ts',
    'src/core/domain/contracts/auth.ts',
    'src/core/domain/errors/error-contract.ts',
    'tests/fixtures/contracts/legacy-reading.ts',
  ]) assert.ok(exists(file), file);
  for (const file of [
    'src/core/domain/contracts/reading.ts',
    'src/core/domain/contracts/clinical-parameter.ts',
    'src/core/domain/contracts/legacy-reading.ts',
    'src/core/domain/contracts/error.ts',
    'src/core/infrastructure/http/dto/index.ts',
  ]) assert.equal(exists(file), false, file);
  const legacy = fs.readFileSync(path.join(root, 'src/modules/monitoring/application/ports/monitoring-port.ts'), 'utf8');
  assert.doesNotMatch(legacy, /\breadingDetail\b/);
});

test('organización: puertos, operaciones, adaptadores, composición y pruebas no conservan archivos duplicados en rutas anteriores', () => {
  for (const module of fs.readdirSync(path.join(root, 'src/modules'))) {
    const application = `src/modules/${module}/application`;
    const infrastructure = `src/modules/${module}/infrastructure`;
    if (exists(application)) assert.deepEqual(files(application).filter(file => /\.tsx?$/.test(file) && file !== 'index.ts'), [], application);
    if (exists(infrastructure)) assert.deepEqual(files(infrastructure).filter(file => /-api\.ts$/.test(file)), [], infrastructure);
  }
  assert.deepEqual(files('composition').filter(file => /\.tsx?$/.test(file)), []);
  assert.deepEqual(files('tests').filter(file => /\.test\.cjs$/.test(file)), []);
  for (const dir of ['composition/configure','composition/routes','tests/architecture','tests/contracts','tests/functional']) assert.ok(exists(dir), dir);
});
