/* global __dirname */
/**
 * Verifica las reglas de arquitectura limpia de src/ (ver docs/arquitectura.md).
 *   npm run check:arch
 * Falla si una capa importa otra que tiene prohibida. El resto (adaptadores por
 * defecto, dependencias entre módulos) se informa para revisarlo.
 */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name)) files.push(p); } })('src');
const re = /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(['"])([^'"]+)\1/gm;
function where(p) {
  const m = p.match(/^src\/(core|shared|modules\/([^/]+))\/(domain|application|infrastructure|presentation)\//);
  if (!m) return null;
  return { area: m[2] ?? m[1], layer: m[3] };
}
// Lo que cada capa NO debe importar.
const FORBIDDEN = {
  domain: ['application', 'infrastructure', 'presentation'],
  application: ['presentation'],
  infrastructure: ['application', 'presentation'],
  presentation: [],
};
const out = { forbidden: [], coreToModules: [], appToInfra: [], presToInfra: [], crossModule: {} };
for (const f of files) {
  const from = where(f); if (!from) { out.forbidden.push(`${f}: fuera de una capa`); continue; }
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(re)) {
    const spec = m[2];
    let t;
    if (spec.startsWith('@/')) t = spec.slice(2); else if (spec.startsWith('.')) t = path.relative(root, path.resolve(path.dirname(f), spec)); else continue;
    const to = where(t);
    if (!to) continue;
    const typeOnly = /import\s+type\s*\{[^}]*\}\s*from\s*$/.test(src.slice(Math.max(0, m.index - 300), m.index + 5));
    if (FORBIDDEN[from.layer].includes(to.layer)) out.forbidden.push(`${f} (${from.layer}) -> ${t} (${to.layer})`);
    if ((from.area === 'core' || from.area === 'shared') && !['core', 'shared'].includes(to.area)) out.coreToModules.push(`${f} -> ${t}`);
    if (from.layer === 'application' && to.layer === 'infrastructure' && to.area !== 'core') out.appToInfra.push(`${f} -> ${t}`);
    if (from.layer === 'presentation' && to.layer === 'infrastructure' && to.area !== 'core' && !typeOnly) out.presToInfra.push(`${f} -> ${t}`);
    if (!['core', 'shared'].includes(from.area) && !['core', 'shared'].includes(to.area) && from.area !== to.area) {
      const k = `${from.area} -> ${to.area}`; out.crossModule[k] = (out.crossModule[k] || 0) + 1;
    }
  }
}
console.log('Prohibidas:', out.forbidden.length); out.forbidden.forEach((x) => console.log('  ' + x));
console.log('core/shared -> módulos:', out.coreToModules.length); out.coreToModules.forEach((x) => console.log('  ' + x));
console.log('application -> infrastructure de un módulo (adaptador por defecto):', out.appToInfra.length); out.appToInfra.forEach((x) => console.log('  ' + x));
console.log('presentation -> infrastructure de un módulo:', out.presToInfra.length); out.presToInfra.forEach((x) => console.log('  ' + x));
console.log('Dependencias entre módulos:', out.crossModule);
process.exit(out.forbidden.length ? 1 : 0);
