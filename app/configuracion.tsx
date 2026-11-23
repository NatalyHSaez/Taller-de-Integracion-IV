import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Action, Card, Copy, FlowPage } from '@/src/shared/presentation/components/flow-ui';
import { authService } from '@/src/modules/identity/application/authservice';
import { verifyP7Integration, type P7Report } from '@/src/core/infrastructure/http/integration-check';
import { authSession } from '@/src/core/application/session/auth-session';
import { appState } from '@/src/core/application/session/app-state';

/** P7: comprobación manual desde el dispositivo que ejecuta Expo. */
function IntegrationCheck() {
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<P7Report | null>(null);
  const check = async () => {
    if (checking) return;
    setChecking(true);
    setReport(null);
    try {
      const generation = authSession.generation();
      const user = authSession.user();
      const patientId = appState.snapshot().selectedPatient?.id ?? null;
      const report = await verifyP7Integration({
        userId: user?.id ?? null,
        roles: user?.roles ?? [],
        selectedPatientId: patientId,
        isCurrent: () => authSession.mode() === 'backend'
          && authSession.generation() === generation
          && appState.snapshot().selectedPatient?.id === patientId,
      });
      if (authSession.generation() === generation) setReport(report);
    }
    catch (cause) { setReport({ ready: false, steps: [{ key: 'identity', status: 'error',
      description: cause instanceof Error ? cause.message : 'Error inesperado en la comprobación.' }] }); }
    finally { setChecking(false); }
  };
  return (
    <Card>
      <Copy>Verificación P7 (solo lectura): Gateway, sesión, paciente y lecturas disponibles.</Copy>
      <Action secondary label={checking ? 'Comprobando conexión...' : 'Comprobar integración con backend'}
        onPress={() => { void check(); }} />
      {report && (
        <>
          <Copy>{report.ready ? 'Comprobación completa.' : 'Hay comprobaciones pendientes o con errores.'}</Copy>
          {report.steps.map((step) => (
            <Copy key={step.key}>{step.status === 'ok' ? 'OK' : step.status === 'warning' ? 'PENDIENTE' : 'ERROR'}: {step.description}</Copy>
          ))}
        </>
      )}
    </Card>
  );
}

export default function Configuracion() {
  const router = useRouter();
  return (
    <FlowPage title="Configuración" subtitle="Configuración de tu cuenta real.">
      <Card><Copy>El backend permite editar tu nombre desde Perfil. El correo, la contraseña y las preferencias no se pueden modificar aquí mientras la API no lo permita.</Copy></Card>
      <IntegrationCheck />
      <Action secondary label="Ir a mi perfil" onPress={() => router.push('/perfil')} />
      <Action label="Cerrar sesión" onPress={() => void authService.logout()
        .then(() => router.replace('/(auth)/login'))
        .catch(() => console.error('No se pudo cerrar la sesión.'))} />
    </FlowPage>
  );
}
