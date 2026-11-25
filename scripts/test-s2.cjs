#!/usr/bin/env node
'use strict';
/**
 * S2 adaptado al proyecto modular src/.
 * La versión original queda en el historial de Git.
 * Adaptación por cobertura funcional: NO equivale a migración 1:1 de cada caso legado.
 */
const { run } = require('./legacy-suite-runner.cjs');
const checks = [
  ['S2: validación del detalle de lectura', ['--require', './tests/support/register.cjs', '--test', 'tests/contracts/s2-bridge.test.cjs']],
  ['S2: detalle, confirmación, errores y sesión', ['--require', './tests/support/register.cjs', '--test', 'tests/functional/reading-detail.test.cjs', 'tests/functional/reading-confirmation-ui.test.cjs', 'tests/functional/reading-flow.test.cjs', 'tests/contracts/readings-api.test.cjs']]
];
for (const [label, args] of checks) {
  if (!run(label, ...args)) break;
}
if (!process.exitCode) console.log('\nS2 modular aprobado. Las pruebas legadas no se ejecutan automáticamente.');
