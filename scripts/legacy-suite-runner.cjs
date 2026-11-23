#!/usr/bin/env node
'use strict';
/**
 * Ejecuta comprobaciones sobre los módulos actuales de src/.
 * El script anterior a la reorganización se conserva en scripts/legacy/.
 * Atención: esta suite es una sustitución explícita, no acredita que cada
 * caso del script heredado haya sido migrado individualmente.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
function run(label, ...args) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`FALLÓ: ${label} (salida ${result.status ?? 'sin código'}).`);
    process.exitCode = 1;
    return false;
  }
  console.log(`APROBADO: ${label}`);
  return true;
}
function runNpm(label, script) {
  // Ejecutamos npm-cli.js con node en vez de pasar argumentos por shell:true:
  // evita DEP0190 en Windows y no crea otra capa de shell.
  const fs = require('node:fs');
  const cliCandidates = [
    process.env.npm_execpath,
    path.resolve(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
  ];
  const cli = cliCandidates.find((file) => file && file.endsWith('.js') && fs.existsSync(file));
  if (cli) return run(label, cli, 'run', script);
  // Alternativa para instalaciones de Node donde npm está en otra ruta.
  // `script` es un nombre fijo declarado por el proyecto; no incluye entrada externa.
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['run', script], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`FALLÓ: ${label} (salida ${result.status ?? 'sin código'}).`);
    process.exitCode = 1;
    return false;
  }
  console.log(`APROBADO: ${label}`);
  return true;
}
module.exports = { run, runNpm };
