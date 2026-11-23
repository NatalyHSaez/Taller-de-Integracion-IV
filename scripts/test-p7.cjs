#!/usr/bin/env node
'use strict';
/**
 * P7 adaptado a src/: diagnóstico HTTP de solo lectura con respuestas simuladas.
 * El script de Cristian se conserva en scripts/legacy/test-p7.cjs, pero sus
 * nueve casos antiguos no se ejecutan ni se consideran migrados 1:1.
 * La prueba real de Docker/Gateway es scripts/verify-p7-live.cjs (opcional).
 */
const { run } = require('./legacy-suite-runner.cjs');
if (run('P7: diagnóstico Gateway, identidad, selección y autorización',
  '--require', './tests/support/register.cjs', '--test', 'tests/p7-bridge.test.cjs')) {
  console.log('\nP7 simulado aprobado. P7 real con Docker/API Gateway sigue pendiente.');
}
