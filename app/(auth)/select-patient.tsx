import { useRouter } from 'expo-router';
import { Action, Card, Copy, FlowPage } from '@/components/flow-ui';
import { useDemo } from '@/hooks/use-demo';
import { demo } from '@/services/demo-store';
export default function SelectPatient() {
  const router = useRouter(); const { patients, user, relations, profiles } = useDemo();
  return <FlowPage title={patients.length ? '¿A quién acompañas hoy?' : 'Aún no tienes pacientes vinculados'} subtitle={`Hola, ${user?.name ?? ''}. Solo puedes acceder a vínculos aprobados.`}>
    {patients.map((p) => <Card key={p.id}><Copy>{p.name}</Copy><Action label="Acompañar a este paciente" onPress={() => { demo.select(p.id); router.replace('/(tabs)'); }} /></Card>)}
    {relations.filter((r) => r.caregiverId === user?.id && r.status !== 'approved').map((r) => <Card key={r.id}><Copy>{profiles.find((p) => p.id === r.patientId)?.name}</Copy><Copy>{r.status === 'pending' ? 'Solicitud pendiente de aprobación. Todavía no tienes acceso a información clínica.' : r.status === 'rejected' ? 'El paciente rechazó la solicitud.' : 'El paciente retiró tu acceso.'}</Copy></Card>)}
    <Action label="Escanear QR o abrir invitación" onPress={() => router.push('/invitacion')} />
    <Action secondary label="Cerrar sesión" onPress={() => { demo.logout(); router.replace('/(auth)/login'); }} />
    <Action secondary label="Ver guía de demostración" onPress={() => router.push('/demo')} />
  </FlowPage>;
}
