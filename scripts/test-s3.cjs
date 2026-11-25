#!/usr/bin/env node
'use strict';
/**
 * S3 sobre src/: series clínicas y gráficas, validación, caché y cambio de paciente.
 * El S3 original (29 casos) se conserva en el historial de Git.
 * Estas comprobaciones NO sustituyen cada caso legado de forma individual.
 */
const { run } = require('./legacy-suite-runner.cjs');
const checks = [
  ['S3: contratos de series, fechas, caché y aislamiento', ['--require', './tests/support/register.cjs', '--test', 'tests/contracts/s3-bridge.test.cjs']],
  ['S3: series, presión arterial, gráficos y autorización', ['--require', './tests/support/register.cjs', '--test', 'tests/functional/measurement-series.test.cjs', 'tests/functional/error-matrix.test.cjs', 'tests/functional/home-summary.test.cjs']],
];
for (const [label, args] of checks) {
  if (!run(label, ...args)) break;
}
if (!process.exitCode) console.log('\nS3 modular aprobado. Los 29 casos legados no se ejecutan automáticamente.');
