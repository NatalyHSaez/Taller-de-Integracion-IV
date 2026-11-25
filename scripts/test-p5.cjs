#!/usr/bin/env node
'use strict';
/**
 * P5 adaptado a la estructura src/ de main.
 * El guion anterior permanece en el historial de Git para preservar
 * la cobertura pendiente de migración caso a caso.
 */
const { run } = require('./legacy-suite-runner.cjs');
const checks = [
  ['P5: UUID, vínculos y permisos de cuidador', [
    '--require', './tests/support/register.cjs', '--test',
    'tests/functional/caregiver-permissions.test.cjs', 'tests/functional/patient-links.test.cjs',
    'tests/functional/patient-profile.test.cjs', 'tests/contracts/p5-bridge.test.cjs',
  ]],
  ['P5: códigos, revocación y aislamiento por vínculo', [
    '--require', './tests/support/register.cjs', '--test',
    'tests/functional/link-codes.test.cjs', 'tests/functional/relationship-actions.test.cjs',
  ]],
];
for (const [label, args] of checks) {
  if (!run(label, ...args)) break;
}
if (!process.exitCode) console.log('\nP5 actual: pruebas aprobadas. Los casos legados no se ejecutan automáticamente.');
