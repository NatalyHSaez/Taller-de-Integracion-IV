#!/usr/bin/env node
'use strict';
// Pruebas P3 adaptadas para la estructura modular de main.
// Los 35+ casos originales se conservan en scripts/legacy/test-p3.cjs;
// aquí se prueban los contratos actuales, no los imports services/ eliminados.
const { run, runNpm } = require('./legacy-suite-runner.cjs');
runNpm('P3: contrato ApiError y manejo HTTP', 'test:api-errors');
if (!process.exitCode) run('P3: retry, seguridad y normalización',
  '--require', './tests/support/register.cjs', '--test', 'tests/p3-bridge.test.cjs');
if (!process.exitCode) run('P3: errores sin filtración, datos de lecturas y notificaciones',
  '--require', './tests/support/register.cjs', '--test',
  'tests/error-matrix.test.cjs', 'tests/notifications.test.cjs', 'tests/readings-service.test.cjs');
if (!process.exitCode) console.log('\nP3 actual: pruebas aprobadas. Los casos legados no se ejecutan automáticamente.');
