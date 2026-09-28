import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Action, Card, Copy, Field, FlowPage } from '@/components/flow-ui';
import { demo, type Profile } from '@/services/demo-store';
export default function DemoScreen() {
  const router = useRouter(); const [name, setName] = useState('Juan Pérez'); const [email, setEmail] = useState('juan@ejemplo.com');
  const [profile, setProfile] = useState<Profile>(); const [error, setError] = useState('');
  return <FlowPage title="Primer ingreso · demostración" subtitle="Todo ocurre en esta misma app. Cambia de cuenta cerrando sesión; no recargues la página durante la prueba.">
    <Card><Copy>1. Simular el registro desde la web del doctor</Copy><Copy>Representamos a un doctor ya habilitado por el administrador. Este panel solo prepara la invitación de prueba.</Copy><Field label="Nombre del paciente" value={name} onChangeText={setName} /><Field label="Correo del paciente" value={email} onChangeText={setEmail} autoCapitalize="none" /><Action label="Registrar paciente y generar invitación" onPress={() => { try { setProfile(demo.registerPatient(name, email)); setError(''); } catch (e) { setError((e as Error).message); } }} />{!!error && <Copy>{error}</Copy>}{profile && <><Copy>Entrega este código al paciente: {profile.code}</Copy><Copy>Correo: {profile.email}. Válido por 24 horas y de un solo uso. El paciente elige su contraseña.</Copy></>}</Card>
    <Copy>2. Activa la cuenta con ese código y correo. En Menú → Vínculos, genera una invitación para el cuidador.</Copy>
    <Copy>3. Usa “Continuar como familiar” y crea su cuenta. Solicita el vínculo.</Copy>
    <Copy>4. Cierra sesión e ingresa como paciente. En Vínculos, acepta o rechaza la solicitud y elige los permisos.</Copy>
    <Copy>5. Ingresa como cuidador y abre el paciente autorizado. Para probar varios pacientes, repite el registro con otro correo y vincula al mismo cuidador.</Copy>
    <Copy>El apoyo del centro para activar cuentas o autorizar vínculos requiere un procedimiento acordado con el equipo; no se simula una autorización en nombre del paciente.</Copy>
    <Action label="Ir al acceso" onPress={() => { demo.logout(); router.replace('/(auth)/login'); }} />
  </FlowPage>;
}
