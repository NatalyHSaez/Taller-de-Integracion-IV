import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { appState } from '@/src/core/application/session/app-state';
import { authSession } from '@/src/core/application/session/auth-session';
import { getApiErrorMessage } from '@/src/core/infrastructure/http/errors';
import { useAppState } from '@/src/core/presentation/session/use-app-state';
import { authService } from '@/src/modules/identity/application/authservice';
import { useAuth } from '@/src/modules/identity/presentation/hooks/use-auth';
import { LINK_TYPE_LABELS, takeLinkConfirmation } from '@/src/modules/relationships/application/link-codes';
import { LeavePatientAction } from '@/src/modules/relationships/presentation/components/leave-patient-action';
import { Alert } from '@/src/modules/relationships/presentation/confirm-dialog';
import { Action, Card, Copy, FlowPage } from '@/src/shared/presentation/components/flow-ui';

type PatientsLoadState = {
  scope: string;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

export default function SelectPatient() {
  const router = useRouter();
  const { user, patients, selectPatient, sessionMode } = useAppState();
  const { setUser } = useAuth();

  const isBackendCaregiver = sessionMode === 'backend' && user?.source === 'backend' && user.role === 'caregiver';
  const userId = user?.id;
  const scope = isBackendCaregiver ? `${authSession.generation()}:${userId ?? ''}` : '';
  const [loadState, setLoadState] = useState<PatientsLoadState>({
    scope: '', loading: false, loaded: false, error: null,
  });
  const [actionError, setActionError] = useState('');
  const [selecting, setSelecting] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const requestSerial = useRef(0);
  const [confirmation] = useState(() => ({
    userId: appState.snapshot().user?.id ?? null,
    value: takeLinkConfirmation(),
  }));

  // Esta carga usa la API real de main. No depende de campos ausentes en useAppState.
  const reloadPatients = useCallback(async (): Promise<void> => {
    if (!isBackendCaregiver) return;
    const serial = ++requestSerial.current;
    setLoadState({ scope, loading: true, loaded: false, error: null });
    try {
      await appState.loadRealPatients();
      if (serial === requestSerial.current && appState.snapshot().user?.id === userId) {
        setLoadState({ scope, loading: false, loaded: true, error: null });
      }
    } catch (cause) {
      if (serial === requestSerial.current && appState.snapshot().user?.id === userId) {
        setLoadState({
          scope, loading: false, loaded: false,
          error: getApiErrorMessage(cause, 'No fue posible actualizar los pacientes vinculados.'),
        });
      }
    }
  }, [isBackendCaregiver, scope, userId]);

  useEffect(() => {
    let active = true;
    // Diferimos la carga para permitir la limpieza del efecto al cambiar de cuenta.
    void Promise.resolve().then(() => {
      if (active) void reloadPatients();
    });
    return () => {
      active = false;
      requestSerial.current += 1;
    };
  }, [reloadPatients]);

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === 'patient') return <Redirect href="/(tabs)" />;

  const loading = isBackendCaregiver && (loadState.scope !== scope || loadState.loading);
  const loadError = isBackendCaregiver && loadState.scope === scope ? loadState.error : null;
  const patientsLoaded = isBackendCaregiver && loadState.scope === scope && loadState.loaded;
  const linkedConfirmation = user.source === 'backend' && confirmation.userId === user.id
    ? confirmation.value
    : null;

  async function choose(patientId: string) {
    if (selecting || loading) return;
    setSelecting(patientId);
    setActionError('');
    try {
      if (sessionMode === 'backend') {
        // La lista puede haber cambiado desde que se mostró la pantalla.
        await appState.loadRealPatients();
        const current = appState.snapshot();
        if (current.user?.id !== user?.id || current.sessionMode !== 'backend') return;
        if (!current.patients.some((patient) => patient.id === patientId)) {
          throw new Error('El vínculo ya no está activo. Actualiza tus pacientes.');
        }
      }

      selectPatient(patientId);
      if (appState.snapshot().selectedPatient?.id !== patientId) {
        throw new Error('No se pudo seleccionar al paciente. Comprueba que el vínculo siga vigente.');
      }
      router.replace('/(tabs)');
    } catch (cause) {
      setActionError(getApiErrorMessage(cause, 'No fue posible seleccionar el paciente.'));
    } finally {
      setSelecting(null);
    }
  }

  async function performLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setActionError('');
    try {
      await authService.logout();
      setUser(null);
      router.replace('/(auth)/login');
    } catch (cause) {
      setActionError(getApiErrorMessage(cause, 'No se pudo cerrar la sesión correctamente.'));
    } finally {
      setLoggingOut(false);
    }
  }

  function confirmLogout() {
    if (loggingOut) return;
    Alert.alert('Cerrar sesión', '¿Deseas cerrar tu sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void performLogout() },
    ]);
  }

  return (
    <FlowPage
      title={loading && patients.length === 0
        ? 'Consultando tus pacientes…'
        : patients.length > 0 ? '¿A quién acompañas hoy?' : 'Aún no tienes pacientes vinculados'}
      subtitle={`Hola, ${user.name}. Solo puedes acceder a vínculos aprobados.`}>

      {linkedConfirmation && (
        <Card>
          <Copy>
            ✓ Te vinculaste con {linkedConfirmation.patientName} como{' '}
            {LINK_TYPE_LABELS[linkedConfirmation.relationshipType] ?? 'acompañante'}.
          </Copy>
          <Copy>
            {linkedConfirmation.relationshipType === 'CAREGIVER'
              ? 'El paciente puede ajustar tus permisos desde su pantalla de Vínculos.'
              : 'Tu vinculación quedó registrada. Los accesos dependen de tu rol y permisos.'}
          </Copy>
        </Card>
      )}

      {isBackendCaregiver && (
        <>
          {loading && <Copy>Actualizando relaciones y permisos desde el servidor…</Copy>}
          {!!loadError && <Card><Copy>{loadError}</Copy></Card>}
          {patientsLoaded && patients.length === 0 && (
            <Copy>No existen vínculos activos para esta cuenta. Solicita un código de vinculación al paciente.</Copy>
          )}
          <Action
            secondary
            disabled={loading || Boolean(selecting) || loggingOut}
            label={loading ? 'Actualizando pacientes…' : 'Actualizar mis pacientes'}
            onPress={() => void reloadPatients()}
          />
        </>
      )}

      {!!actionError && <Card><Copy>{actionError}</Copy></Card>}

      {patients.map((patient) => (
        <Card key={patient.id}>
          <Copy>{patient.name}</Copy>
          <Action
            label={selecting === patient.id ? 'Verificando vínculo…' : 'Acompañar a este paciente'}
            disabled={loading || Boolean(selecting) || loggingOut}
            onPress={() => void choose(patient.id)}
          />
          {isBackendCaregiver && (
            <LeavePatientAction
              patientId={patient.id}
              patientName={patient.name}
              onLeft={reloadPatients}
            />
          )}
        </Card>
      ))}

      <Action
        label="Escanear QR o ingresar código de vinculación"
        disabled={loggingOut}
        onPress={() => router.push('/invitacion')}
      />
      {isBackendCaregiver && patientsLoaded && patients.length === 0 && (
        <Action secondary label="Ir a mi perfil" onPress={() => router.replace('/perfil')} />
      )}
      <Action
        secondary
        label={loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        disabled={loggingOut}
        onPress={confirmLogout}
      />
    </FlowPage>
  );
}
