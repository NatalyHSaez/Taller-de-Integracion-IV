#!/usr/bin/env node
'use strict';
/**
 * P6 adaptado a la estructura src/ de main: mocks, aislamiento y caché.
 * El script antiguo permanece en scripts/legacy/test-p6.cjs.
 */
const { run } = require('./legacy-suite-runner.cjs');
const checks = [
  ['P6: caché por sesión, URL y filtros; concurrencia y errores', [
    '--require', './tests/support/register.cjs', '--test', 'tests/p6-bridge.test.cjs',
  ]],
  ['P6: mocks, lecturas, gráficos y notificaciones', [
    '--require', './tests/support/register.cjs', '--test',
    'tests/notifications.test.cjs', 'tests/readings-service.test.cjs',
    'tests/measurement-series.test.cjs', 'tests/patient-alerts.test.cjs',
    'tests/error-matrix.test.cjs',
  ]],
];
for (const [label, args] of checks) {
  if (!run(label, ...args)) break;
}
if (!process.exitCode) console.log('\nP6 actual: pruebas aprobadas. Los casos legados no se ejecutan automáticamente.');
