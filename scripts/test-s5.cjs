#!/usr/bin/env node
'use strict';
/**
 * S5 adaptado a src/: notificaciones internas, paginación, lectura y sesión.
 * El script S5 original se conserva en el historial de Git.
 * Estas pruebas son una cobertura modular actualizada, no una migración uno a uno.
 */
const {run}=require('./legacy-suite-runner.cjs');
const checks=[
  ['S5: contrato del Gateway, filtros y aislamiento', ['--require','./tests/support/register.cjs','--test','tests/s5-bridge.test.cjs']],
  ['S5: notificaciones, UI, paginación, lectura y errores', ['--require','./tests/support/register.cjs','--test','tests/notifications.test.cjs','tests/error-matrix.test.cjs']],
];
for (const [label,args] of checks){ if(!run(label,...args)) break; }
if (!process.exitCode) console.log('\nS5 modular aprobado. Los casos legados no se ejecutan automáticamente.');
