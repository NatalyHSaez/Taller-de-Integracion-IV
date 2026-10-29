import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

import { Action, Card, Copy, FlowPage } from '@/components/flow-ui';
import { useAppState } from '@/hooks/use-app-state';
import { useAuth } from '@/hooks/use-auth';
import { useDemo } from '@/hooks/use-demo';
import { authService } from '@/services/authservice';
import { getApiErrorMessage } from '@/services/errors';

export default function SelectPatient() {
  const router = useRouter();
  const { user, patients, selectPatient, refreshPatients, patientsLoading,
    patientsLoaded, patientsError, sessionMode } = useAppState();
  const { relations, profiles } = useDemo();
  const { setUser } = useAuth();
  const [actionError, setActionError] = useState('');
  const [selecting, setSelecting] = useState<string | null>(null);

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === 'patient') return <Redirect href="/(tabs)" />;

  async function performLogout() {
    await authService.logout();
    setUser(null);
    router.replace('/(auth)/login');
  }
  function confirmLogout() {
    if (Platform.OS === 'web') {
      if (window.confirm('¿Deseas cerrar tu sesión?')) void performLogout();
      return;
    }
    Alert.alert('Cerrar sesión', '¿Deseas cerrar tu sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void performLogout() },
    ]);
  }
  async function choose(patientId: string) {
    setSelecting(patientId);
    setActionError('');
    try {
      await selectPatient(patientId);
      router.replace('/(tabs)');
    } catch (cause) {
      setActionError(getApiErrorMessage(cause, 'No fue posible seleccionar el paciente.'));
    } finally { setSelecting(null); }
  }
  async function reload() {
    setActionError('');
    try { await refreshPatients(); }
    catch (cause) { setActionError(getApiErrorMessage(cause, 'No fue posible actualizar tus pacientes.')); }
  }

  return (
    <FlowPage
      title={patientsLoading && !patientsLoaded ? 'Consultando tus pacientes…' :
        patients.length ? '¿A quién acompañas hoy?' : 'Aún no tienes pacientes vinculados'}
      subtitle={`Hola, ${user.name}. Solo puedes acceder a vínculos aprobados.`}
    >
      {sessionMode === 'backend' && <>
        {patientsLoading && <Copy>Actualizando relaciones y permisos desde el servidor…</Copy>}
        {!!(patientsError || actionError) && <Card><Copy>{actionError || patientsError}</Copy></Card>}
        {!patientsLoading && patientsLoaded && patients.length === 0 &&
          <Copy>No existen vínculos activos para esta cuenta. Solicita al paciente un código de vinculación.</Copy>}
        <Action secondary label="Actualizar mis pacientes" onPress={() => void reload()} />
      </>}
      {patients.map((patient) => (
        <Card key={patient.id}>
          <Copy>{patient.name}</Copy>
          <Action label={selecting === patient.id ? 'Verificando vínculo…' : 'Acompañar a este paciente'}
            onPress={() => { if (!selecting && !patientsLoading) void choose(patient.id); }} />
        </Card>
      ))}
      {sessionMode === 'mock' && relations
        .filter((relation) => relation.caregiverId === user.id && relation.status !== 'approved')
        .map((relation) => {
          const profile = profiles.find((item) => item.id === relation.patientId);
          return <Card key={relation.id}>
            <Copy>{profile?.name ?? 'Paciente'}</Copy>
            <Copy>{relation.status === 'pending' ? 'Solicitud pendiente de aprobación.' :
              relation.status === 'rejected' ? 'Solicitud rechazada.' : 'El paciente retiró tu acceso.'}</Copy>
          </Card>;
        })}
      <Action label="Ingresar código de vinculación" onPress={() => router.push('/invitacion')} />
      <Action secondary label="Cerrar sesión" onPress={confirmLogout} />
      {sessionMode === 'mock' && <Action secondary label="Ver guía de demostración" onPress={() => router.push('/demo')} />}
    </FlowPage>
  );
}
