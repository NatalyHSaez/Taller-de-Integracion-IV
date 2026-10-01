import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Action, Card, Copy, Field, FlowPage } from '@/components/flow-ui';
import { useAppState } from '@/hooks/use-app-state';
import { useDemo } from '@/hooks/use-demo';
import { demo, type Invitation } from '@/services/demo-store';
export default function InvitationScreen() {
  const router = useRouter(); const params = useLocalSearchParams<{ token?: string }>();
  const { user, selectedPatient } = useAppState();
  const { pendingToken, profiles, invitations } = useDemo();
  const [code, setCode] = useState(params.token ?? pendingToken ?? ''); const [preview, setPreview] = useState<Invitation>();
  const [error, setError] = useState(''); const [scanner, setScanner] = useState(false); const [install, setInstall] = useState(false);
  const [scanTime, setScanTime] = useState(() => Date.now());
  function inspect(value: string) { try { const token = value.includes('token=') ? decodeURIComponent(value.split('token=')[1].split('&')[0]) : value.trim(); const invitation = demo.invitation(token); setPreview(invitation); demo.remember(invitation.token); setError(''); } catch (e) { setPreview(undefined); setError((e as Error).message); } }
  return <FlowPage title="Invitación de cuidado" subtitle="Abrir una invitación no da acceso a los datos del paciente.">
    <Field label="Código o enlace de invitación" value={code} onChangeText={(v) => { setCode(v); setPreview(undefined); }} autoCapitalize="none" />
    <Action label="Revisar invitación" onPress={() => inspect(code)} />
    <Action secondary label="Escanear QR (simulación)" onPress={() => { setScanTime(Date.now()); setScanner(!scanner); }} />
    {scanner && <Card><Copy>Simula la lectura del QR mostrado por el paciente. Elige una invitación generada en esta sesión.</Copy>{invitations.filter((i) => i.expires > scanTime).map((i) => <Action key={i.token} secondary label={`Leer QR de ${profiles.find((p) => p.id === i.patientId)?.name}`} onPress={() => { setCode(i.token); inspect(i.token); setScanner(false); }} />)}{!invitations.some((i) => i.expires > scanTime) && <Copy>No hay invitaciones vigentes. Pide al paciente que genere una.</Copy>}</Card>}
    {!!error && <Copy>{error}</Copy>}
    {preview && <Card><Copy>{profiles.find((p) => p.id === preview.patientId)?.name} te invita a acompañarle.</Copy><Copy>Vence: {new Date(preview.expires).toLocaleString('es-CL')}</Copy>{!user ? <><Action label="Iniciar sesión para continuar" onPress={() => router.push('/(auth)/login')} /><Action secondary label="Crear cuenta de cuidador" onPress={() => router.push('/(auth)/register')} /><Action secondary label="Simular que no tengo la app" onPress={() => setInstall(true)} />{install && <><Copy>En producción, este enlace te orientará a instalar Domicilia. Aquí simulamos la instalación y conservamos la invitación.</Copy><Action label="Simular instalación y retomar invitación" onPress={() => { setInstall(false); router.push('/(auth)/register'); }} /></>}</> : user.role === 'caregiver' ? <Action label="Solicitar vínculo" onPress={() => { try { demo.request(preview.token); router.replace('/(auth)/select-patient'); } catch (e) { setError((e as Error).message); } }} /> : <Copy>Estás usando una cuenta de paciente. Cierra sesión para continuar como cuidador.</Copy>}</Card>}
    <Action secondary label={user ? 'Volver a mi cuenta' : 'Volver al acceso'} onPress={() => router.replace(user ? selectedPatient ? '/(tabs)' : '/(auth)/select-patient' : '/(auth)/login')} />
  </FlowPage>;
}
