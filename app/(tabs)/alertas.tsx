import { backendAlertsService } from '@/src/modules/evaluation/infrastructure/alerts-api';
import { PatientAlertsScreen } from '@/src/modules/evaluation/presentation/screens/patient-alerts-screen';

/** Ruta de Expo Router y punto de composición del módulo. */
export default function AlertasScreen() {
  return <PatientAlertsScreen service={backendAlertsService} />;
}
