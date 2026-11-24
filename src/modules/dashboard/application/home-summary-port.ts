import type { PatientAlert } from '../../evaluation/domain/alert';
import type { Measurement } from '../../monitoring/domain/measurement';

export type HomeSummaryDeps = {
  measurements: (patientId: string) => Promise<Measurement[]>;
  openAlerts: (patientId: string) => Promise<PatientAlert[]>;
  caregiverPermissions: (patientId: string) => Promise<string[]>;
};

let dependencies: HomeSummaryDeps | undefined;

export function configureHomeSummary(value: HomeSummaryDeps): void {
  dependencies = value;
}

export function homeSummaryDependencies(): HomeSummaryDeps {
  if (!dependencies) throw new Error('El resumen de Inicio no está configurado.');
  return dependencies;
}
