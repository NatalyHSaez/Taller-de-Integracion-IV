const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
function files(dir) { return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
test('producción: no existe módulo demo ni adaptadores ficticios; las fixtures no se importan', () => {
  assert.equal(fs.existsSync(path.join(root,'src/modules/demo')),false);
  for (const name of ['src/modules/evaluation/infrastructure/demo-alerts.ts','src/modules/notifications/infrastructure/notifications-demo.ts']) assert.equal(fs.existsSync(path.join(root,name)),false);
  for (const file of ['src','app','composition'].flatMap(dir=>files(path.join(root,dir))).filter(f=>/\.tsx?$/.test(f))) {
    assert.doesNotMatch(fs.readFileSync(file,'utf8'), /(?:from|import|require)\s*(?:\(\s*)?['"][^'"]*(?:tests\/fixtures|modules\/demo|demo-alerts|notifications-demo)[^'"]*['"]/);
  }
});
test('errores: dominio e infraestructura comparten una sola clase y el adaptador protege el contenido HTTP', async () => {
  const domain = projectRequire('src/core/domain/errors/index.ts');
  const http = projectRequire('src/core/infrastructure/http/errors/index.ts');
  assert.equal(domain.ApiError,http.ApiError);
  const error = await http.apiErrorFromResponse(new Response('<html>secret</html>',{status:503,headers:{'content-type':'text/html'}}));
  assert.equal(domain.normalizeApiError(error),error);
  assert.equal(error.status,503);
  assert.doesNotMatch(error.message,/secret/);
});
