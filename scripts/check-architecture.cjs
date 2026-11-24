/* Verificador estático de arquitectura: imports, reexports y dependencias locales. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const slash = p => p.split(path.sep).join('/');
const sourceFile = p => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(p);
const layers = /^(src\/(core|shared|modules\/([^/]+)))\/(domain|application|infrastructure|presentation)\//;
function location(p) {
  const m = p.match(layers);
  return m ? { area: m[3] || m[2], layer: m[4] } : null;
}
const allowed = {
  domain: ['domain'], application: ['domain', 'application'],
  infrastructure: ['domain', 'infrastructure'], presentation: ['domain', 'application', 'presentation'],
};
const compositionRoutes = new Set(['app/_layout.tsx', 'app/(tabs)/alertas.tsx', 'app/(auth)/login.tsx', 'app/configuracion.tsx']);
function importsOf(source, filename) {
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const result = [];
  function add(node) { if (node && ts.isStringLiteralLike(node)) result.push(node.text); }
  function visit(n) {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) add(n.moduleSpecifier);
    if (ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference)) add(n.moduleReference.expression);
    if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument)) add(n.argument.literal);
    if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) add(n.arguments[0]);
    ts.forEachChild(n, visit);
  }
  visit(tree);
  return [...new Set(result)];
}
function localTarget(from, spec) {
  if (spec.startsWith('@/')) return path.posix.normalize(spec.slice(2));
  if (spec.startsWith('.')) return path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  return null;
}
function violations(from, to, spec) {
  const a = location(from), b = location(to || '');
  const errors = [];
  if (to && /^(tests|scripts|tmp)(\/|$)/.test(to)) errors.push('producción no puede importar pruebas ni scripts');
  if (a && to && to.startsWith('src/') && !b) errors.push('destino fuera de una capa');
  if (a && to && /^(app|composition)(\/|$)/.test(to)) errors.push('las capas no pueden importar rutas ni composición');
  if (a && b) {
    if (!allowed[a.layer].includes(b.layer)) errors.push(`${a.layer} no puede importar ${b.layer}`);
    if (['core','shared'].includes(a.area) && !['core','shared'].includes(b.area)) errors.push('core/shared no puede depender de módulos');
  }
  if (a && ['domain','application'].includes(a.layer) && !to && /^(react(?:-native)?(?:\/|$)|react-native-|expo(?:\/|$|-)|@expo\/|@react-native)/.test(spec)) errors.push('capa interna no puede depender de React/Expo');
  if (from.startsWith('app/') && to && (b?.layer === 'infrastructure' || to.startsWith('composition/')) && !compositionRoutes.has(from)) errors.push('adaptadores solo en rutas de composición autorizadas');
  if (from.startsWith('composition/') && to?.startsWith('app/')) errors.push('composición no puede importar rutas');
  return errors;
}
function scan(root = ROOT) {
  const files = [];
  function walk(dir) {
    for (const e of fs.readdirSync(path.join(root, dir), {withFileTypes:true})) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p); else if (sourceFile(p)) files.push(p);
    }
  }
  for (const dir of ['src','app','composition']) walk(dir);
  const fileSet = new Set(files);
  const graph = new Map(), forbidden = [], crossModule = {};
  for (const f of files.sort()) {
    const a = location(f), edges = [];
    if (f.startsWith('src/') && !a) forbidden.push(`${f}: fuera de una capa`);
    for (const spec of importsOf(fs.readFileSync(path.join(root,f),'utf8'),f)) {
      const to = localTarget(f,spec), b = location(to || '');
      for (const error of violations(f,to,spec)) forbidden.push(`${f} -> ${spec}: ${error}`);
      if (to) {
        if (to.startsWith('../')) forbidden.push(`${f} -> ${spec}: import fuera del proyecto`);
        const candidates = [to,...['.ts','.tsx','.js','.jsx','.cjs','.mjs','/index.ts','/index.tsx','/index.js'].map(x=>to+x), ...['.web.ts','.web.tsx','.native.ts','.native.tsx','.android.ts','.android.tsx','.ios.ts','.ios.tsx'].map(x=>to+x)];
        for (const c of candidates) if (fileSet.has(c)) edges.push(c);
        if (/^(src|app|composition)\//.test(to) && !candidates.some(c => fileSet.has(c))) forbidden.push(`${f} -> ${spec}: destino local no resuelto`);
      }
      if (a && b && a.area !== b.area && !['core','shared'].includes(a.area) && !['core','shared'].includes(b.area)) {
        const k = `${a.area} -> ${b.area}`; crossModule[k] = (crossModule[k] || 0)+1;
      }
    }
    graph.set(f,[...new Set(edges)]);
  }
  // Ciclos de imports locales (incluye tipos): se informan para revisión.
  const cycles = [], active = new Set(), visited = new Set(), stack = [];
  function dfs(f) {
    if (active.has(f)) { cycles.push([...stack.slice(stack.indexOf(f)),f].join(' -> ')); return; }
    if (visited.has(f)) return;
    active.add(f); stack.push(f);
    for (const t of graph.get(f)||[]) dfs(t);
    stack.pop(); active.delete(f); visited.add(f);
  }
  for (const f of graph.keys()) dfs(f);
  return {files:files.length, forbidden,crossModule,cycles};
}
if (require.main === module) {
  const r=scan();
  console.log('Archivos analizados:',r.files);
  console.log('Prohibidas:',r.forbidden.length); r.forbidden.forEach(x=>console.log('  '+x));
  console.log('Dependencias entre módulos:',r.crossModule);
  console.log('Ciclos detectados (informativo):',r.cycles.length); r.cycles.forEach(x=>console.log('  '+x));
  process.exitCode = r.forbidden.length ? 1 : 0;
}
module.exports={scan,importsOf,localTarget,violations};
