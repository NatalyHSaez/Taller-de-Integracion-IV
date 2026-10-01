import { Redirect, useRouter } from 'expo-router';

import {
  Action,
  Card,
  Copy,
  FlowPage,
} from '@/components/flow-ui';

import { useAuth } from '@/hooks/use-auth';
import { useDemo } from '@/hooks/use-demo';
import { demo } from '@/services/demo-store';

export default function SelectPatient() {
  const router = useRouter();

  const {
    patients,
    user: demoUser,
    relations,
    profiles,
  } = useDemo();

  const {
    user: authUser,
    authenticated,
  } = useAuth();

  /*
   * ---------------------------------------------------------
   * 1. SESIÓN REAL
   * ---------------------------------------------------------
   *
   * Un usuario autenticado mediante backend no debe utilizar
   * todavía esta pantalla.
   *
   * /me/patients todavía no está conectado al backend.
   */
  if (authenticated && authUser) {
    return <Redirect href="/(tabs)" />;
  }

  /*
   * ---------------------------------------------------------
   * 2. SIN SESIÓN
   * ---------------------------------------------------------
   *
   * select-patient es una pantalla privada del recorrido demo.
   *
   * Si Expo Router restaura esta ruta después de cerrar la app,
   * pero ya no existe usuario demo, volvemos al Login.
   */
  if (!demoUser) {
    return <Redirect href="/(auth)/login" />;
  }

  /*
   * ---------------------------------------------------------
   * 3. SESIÓN DEMO
   * ---------------------------------------------------------
   *
   * A partir de aquí sabemos que existe un usuario demo.
   */
  return (
    <FlowPage
      title={
        patients.length
          ? '¿A quién acompañas hoy?'
          : 'Aún no tienes pacientes vinculados'
      }
      subtitle={`Hola, ${demoUser.name}. Solo puedes acceder a vínculos aprobados.`}
    >
      {patients.map((patient) => (
        <Card key={patient.id}>
          <Copy>{patient.name}</Copy>

          <Action
            label="Acompañar a este paciente"
            onPress={() => {
              demo.select(patient.id);
              router.replace('/(tabs)');
            }}
          />
        </Card>
      ))}

      {relations
        .filter(
          (relation) =>
            relation.caregiverId === demoUser.id &&
            relation.status !== 'approved'
        )
        .map((relation) => {
          const profile = profiles.find(
            (item) => item.id === relation.patientId
          );

          return (
            <Card key={relation.id}>
              <Copy>
                {profile?.name ?? 'Paciente'}
              </Copy>

              <Copy>
                {relation.status === 'pending'
                  ? 'Solicitud pendiente de aprobación. Todavía no tienes acceso a información clínica.'
                  : relation.status === 'rejected'
                    ? 'El paciente rechazó la solicitud.'
                    : 'El paciente retiró tu acceso.'}
              </Copy>
            </Card>
          );
        })}

      <Action
        label="Escanear QR o abrir invitación"
        onPress={() => router.push('/invitacion')}
      />

      <Action
        secondary
        label="Cerrar sesión"
        onPress={() => {
          demo.logout();
          router.replace('/(auth)/login');
        }}
      />

      <Action
        secondary
        label="Ver guía de demostración"
        onPress={() => router.push('/demo')}
      />
    </FlowPage>
  );
}