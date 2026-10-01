import { useRouter } from 'expo-router';

import { Action, Card, Copy, FlowPage } from '@/components/flow-ui';
import { useAppState } from '@/hooks/use-app-state';
import { useDemo } from '@/hooks/use-demo';
import { authService } from '@/services/authservice';

export default function SelectPatient() {
  const router = useRouter();
  const { user, patients, selectPatient } = useAppState();
  const { relations, profiles } = useDemo();

  async function logout() {
    await authService.logout();
    router.replace('/(auth)/login');
  }

  return (
    <FlowPage
      title={patients.length ? '¿A quién acompañas hoy?' : 'Aún no tienes pacientes vinculados'}
      subtitle={`Hola, ${user?.name ?? ''}. Solo puedes acceder a vínculos aprobados.`}>
      {patients.map((patient) => (
        <Card key={patient.id}>
          <Copy>{patient.name}</Copy>
          <Action
            label="Acompañar a este paciente"
            onPress={() => {
              selectPatient(patient.id);
              router.replace('/(tabs)');
            }}
          />
        </Card>
      ))}

      {relations
        .filter((relation) => relation.caregiverId === user?.id && relation.status !== 'approved')
        .map((relation) => (
          <Card key={relation.id}>
            <Copy>{profiles.find((profile) => profile.id === relation.patientId)?.name}</Copy>
            <Copy>
              {relation.status === 'pending'
                ? 'Solicitud pendiente de aprobación. Todavía no tienes acceso a información clínica.'
                : relation.status === 'rejected'
                  ? 'El paciente rechazó la solicitud.'
                  : 'El paciente retiró tu acceso.'}
            </Copy>
          </Card>
        ))}

      <Action label="Escanear QR o abrir invitación" onPress={() => router.push('/invitacion')} />
      <Action secondary label="Cerrar sesión" onPress={() => void logout()} />
      <Action secondary label="Ver guía de demostración" onPress={() => router.push('/demo')} />
    </FlowPage>
  );
}
