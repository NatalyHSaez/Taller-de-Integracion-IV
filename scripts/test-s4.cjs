#!/usr/bin/env node
'use strict';
/**
 * S4 sobre src/: alertas clínicas, filtros, contratos, marcado y sesión.
 * El S4 original (28 casos) se conserva en scripts/legacy/test-s4.cjs.
 * Estas comprobaciones NO sustituyen cada caso legado de forma individual.
 */
const { run } = require('./legacy-suite-runner.cjs');
const checks = [
  ['S4: validación del contrato de alertas y aislamiento', ['--require', './tests/support/register.cjs', '--test', 'tests/s4-bridge.test.cjs']],
  ['S4: alertas del paciente, 204, filtros, errores y vista', ['--require', './tests/support/register.cjs', '--test', 'tests/patient-alerts.test.cjs', 'tests/error-matrix.test.cjs', 'tests/home-summary.test.cjs']],
];
for (const [label, args] of checks) {
  if (!run(label, ...args)) break;
}
if (!process.exitCode) console.log('\nS4 modular aprobado. Los 28 casos legados no se ejecutan automáticamente.');
