import { Redirect } from 'expo-router';

/** La activación local de cuentas de prueba fue retirada; el registro real utiliza el backend. */
export default function Activate() {
  return <Redirect href="/(auth)/register" />;
}
