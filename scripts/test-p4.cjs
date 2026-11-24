#!/usr/bin/env node
'use strict';
// Pruebas P4 adaptadas: invocan comprobaciones reales de identidad y sesiones
// de la rama main. El original está en el historial de Git.
const { run } = require('./legacy-suite-runner.cjs');
const steps = [
  ['P4: registro de paciente y cuidador', ['scripts/test-registration.cjs']],
  ['P4: login real, /me, roles y modo demo explícito', ['scripts/test-login.cjs']],
  ['P4: restauración, refresh concurrente, revocación y logout', ['scripts/test-session.cjs']],
  ['P4: almacenamiento de tokens', ['scripts/test-token-storage.cjs']],
  ['P4: permisos e identidad del cuidador', [
    '--require', './tests/support/register.cjs', '--test',
    'tests/caregiver-permissions.test.cjs', 'tests/patient-links.test.cjs',
  ]],
];
for (const [label, args] of steps) {
  if (!run(label, ...args)) break;
}
if (!process.exitCode) console.log('\nP4 actual: pruebas aprobadas. Los casos legados no se ejecutan automáticamente.');
