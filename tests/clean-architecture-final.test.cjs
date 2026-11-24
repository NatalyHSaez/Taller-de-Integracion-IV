const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scan, importsOf, violations } = require('../scripts/check-architecture.cjs');

test('arquitectura final: todo el código productivo cumple las reglas estáticas', () => {
  const result = scan();
  assert.ok(result.files > 0);
  assert.deepEqual(result.forbidden, []);
  assert.deepEqual(result.cycles, []);
});
test('arquitectura final: rechaza dependencias hacia infraestructura Core, UI y fixtures', () => {
  const from = 'src/modules/monitoring/application/use-case.ts';
  for (const dest of ['src/core/infrastructure/http/api-client','src/modules/monitoring/infrastructure/api','tests/fixtures/demo/store','composition/configure-monitoring','app/_layout']) assert.ok(violations(from,dest,'@/'+dest).length, dest);
  assert.ok(violations(from,null,'react-native').length);
  assert.ok(violations('src/core/domain/model.ts','src/modules/identity/domain/model','').length);
  assert.deepEqual(violations(from,'src/core/domain/errors/api-error',''),[]);
  assert.ok(violations('app/(tabs)/alertas.tsx','src/modules/evaluation/infrastructure/alerts-api','').length);
  assert.deepEqual(violations('app/(tabs)/alertas.tsx','composition/alerts-route',''),[]);
  assert.ok(violations('app/historial.tsx','src/modules/monitoring/infrastructure/readings-api','').length);
});
test('arquitectura final: analiza reexportaciones, tipos y cargas dinámicas literales sin confundir comentarios', () => {
  const source = `// import 'fake';\nexport { x } from './one';\nimport type { Y } from './two';\ntype T = import('./three').T;\nconst x = import('./four');\nconst z = require('./five');`;
  assert.deepEqual(importsOf(source,'example.ts'),['./one','./two','./three','./four','./five']);
});
test('arquitectura final: detecta ciclos y destinos locales inexistentes en un proyecto de prueba', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'clean-arch-'));
  try {
    for(const d of ['src/core/domain','app','composition']) fs.mkdirSync(path.join(root,d),{recursive:true});
    fs.writeFileSync(path.join(root,'src/core/domain/a.ts'),"export * from './b'; import './missing';");
    fs.writeFileSync(path.join(root,'src/core/domain/b.ts'),"export * from './a';");
    const r=scan(root);
    assert.ok(r.forbidden.some(x=>x.includes('destino local no resuelto')));
    assert.ok(r.cycles.length);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
