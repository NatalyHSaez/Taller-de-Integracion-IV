import { backendAlertsService } from '@/src/modules/evaluation/infrastructure/alerts-api';
import { PatientAlertsScreen } from '@/src/modules/evaluation/presentation/screens/patient-alerts-screen';

/** Composición de la pantalla con el adaptador real. */
export default function AlertasScreen() {
  return <PatientAlertsScreen service={backendAlertsService} />;
}
