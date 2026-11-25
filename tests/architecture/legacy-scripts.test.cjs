const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
test('organización: no conserva wrappers históricos y mantiene scripts activos', () => {
  const obsolete = ['legacy-suite-runner.cjs', ...[3,4,5,6,7].map(n => `test-p${n}.cjs`), ...[1,2,3,4,5].map(n => `test-s${n}.cjs`)];
  for (const name of obsolete) assert.equal(fs.existsSync(path.join(root, 'scripts', name)), false, name);
  const pkg = require('../../package.json');
  for (const command of Object.values(pkg.scripts)) {
    for (const name of obsolete) assert.ok(!command.includes(name));
    for (const match of command.matchAll(/scripts\/[\w-]+\.cjs/g)) assert.ok(fs.existsSync(path.join(root, match[0])), match[0]);
  }
  for (const name of ['smoke-profile.cjs','smoke-registration.cjs','smoke-session.cjs','verify-p7-live.cjs']) assert.ok(fs.existsSync(path.join(root,'scripts',name)),name);
});
