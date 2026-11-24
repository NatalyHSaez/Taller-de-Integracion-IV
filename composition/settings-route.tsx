import SettingsScreen from '@/src/modules/identity/presentation/screens/settings-screen';
import { verifyP7Integration } from '@/src/core/infrastructure/http/integration-check';

export default function Configuracion() {
  return <SettingsScreen verifyP7Integration={verifyP7Integration} />;
}
