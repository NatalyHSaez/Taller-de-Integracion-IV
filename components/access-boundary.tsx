import { useAuth } from '@/hooks/use-auth';
import { useDemo } from '@/hooks/use-demo';
import { Redirect, usePathname, useRouter, useSegments } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { Action, Copy, FlowPage } from './flow-ui';

export function AccessBoundary({ children }: PropsWithChildren) {
  const {
    user: demoUser,
    patient,
    permissions,
  } = useDemo();

  const {
    user: authUser,
    authenticated,
  } = useAuth();

  const path = usePathname();
  const segments = useSegments();
  const router = useRouter();

  const hasRealSession =
    authenticated && authUser !== null;

  const hasDemoSession =
    demoUser !== null;

  const hasSession =
    hasRealSession || hasDemoSession;

  const isAuthRoute =
    segments[0] === '(auth)';

  /*
   * Si tenemos una sesión REAL y Expo abre una
   * pantalla de autenticación, entramos a la app.
   */
  if (hasRealSession && isAuthRoute) {
    return <Redirect href="/(tabs)" />;
  }

  /*
   * Si NO tenemos sesión y estamos fuera del
   * grupo de autenticación, vamos al Login.
   *
   * No intentamos distinguir select-patient aquí.
   */
  if (
    !hasSession &&
    !isAuthRoute &&
    path !== '/invitacion' &&
    path !== '/demo'
  ) {
    return <Redirect href="/(auth)/login" />;
  }

  /*
   * Selección de paciente SOLO para el flujo demo.
   */
  if (
    hasDemoSession &&
    !hasRealSession &&
    !isAuthRoute &&
    path !== '/perfil' &&
    !patient
  ) {
    return <Redirect href="/(auth)/select-patient" />;
  }

  /*
   * Permisos del cuidador del flujo demo.
   */
  if (
    hasDemoSession &&
    !hasRealSession &&
    demoUser?.role === 'caregiver' &&
    !isAuthRoute
  ) {
    const readPage = [
      '/historial',
      '/graficos',
      '/seguimiento',
    ].includes(path);

    const alertPage =
      path.startsWith('/notificaci') ||
      path === '/alertas';

    const unavailablePage =
      path.startsWith('/documentos') ||
      path === '/atencion';

    if (
      (readPage && !permissions.read) ||
      (
        path === '/registrar-medicion' &&
        !permissions.write
      ) ||
      (alertPage && !permissions.alerts) ||
      unavailablePage
    ) {
      return (
        <FlowPage title="Acceso limitado">
          <Copy>
            Esta sección no está incluida en los permisos de tu vínculo.
          </Copy>

          <Action
            label="Volver al inicio"
            onPress={() => router.replace('/(tabs)')}
          />
        </FlowPage>
      );
    }
  }

  return children;
}