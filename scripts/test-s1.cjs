#!/usr/bin/env node
'use strict';
/**
 * S1 adaptado al proyecto modular src/.
 * La versión original queda en el historial de Git.
 * Adaptación por cobertura funcional: NO equivale a migración 1:1 de cada caso legado.
 */
const { run } = require('./legacy-suite-runner.cjs');
const checks = [
  ['S1: validación clínica y cambios de paciente', ['--require', './tests/support/register.cjs', '--test', 'tests/s1-bridge.test.cjs']],
  ['S1: historial, permisos, paginación, URLs y estados', ['--require', './tests/support/register.cjs', '--test', 'tests/readings-history.test.cjs', 'tests/readings-api.test.cjs', 'tests/caregiver-permissions.test.cjs', 'tests/error-matrix.test.cjs']]
];
for (const [label, args] of checks) {
  if (!run(label, ...args)) break;
}
if (!process.exitCode) console.log('\nS1 modular aprobado. Las pruebas legadas no se ejecutan automáticamente.');
