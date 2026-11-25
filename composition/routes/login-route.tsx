import LoginScreen from "@/src/modules/identity/presentation/screens/login-screen";
import { API_BASE_URL } from "@/src/core/infrastructure/config/api-config";
import { gatewayService } from "@/src/core/infrastructure/http/gateway";

export default function LoginRoute() {
  return <LoginScreen gateway={{ apiBaseUrl: API_BASE_URL, check: gatewayService.health }} />;
}
