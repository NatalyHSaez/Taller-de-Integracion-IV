import { Redirect, usePathname, useRouter, useSegments } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useDemo } from '@/hooks/use-demo';
import { Action, Copy, FlowPage } from './flow-ui';
export function AccessBoundary({ children }: PropsWithChildren) {
  const { user, patient, permissions } = useDemo(); const path = usePathname(); const segments = useSegments(); const router = useRouter();
  const publicPage = segments[0] === '(auth)' || path === '/invitacion' || path === '/demo';
  if (!user && (!publicPage || path === '/select-patient')) return <Redirect href="/(auth)/login" />;
  if (user && !publicPage && path !== '/perfil' && !patient) return <Redirect href="/(auth)/select-patient" />;
  if (user?.role === 'caregiver' && !publicPage) {
    const readPage = ['/historial', '/graficos', '/seguimiento'].includes(path);
    const alertPage = path.startsWith('/notificaci') || path === '/alertas';
    const unavailablePage = path.startsWith('/documentos') || path === '/atencion';
    if ((readPage && !permissions.read) || (path === '/registrar-medicion' && !permissions.write) || (alertPage && !permissions.alerts) || unavailablePage) return <FlowPage title="Acceso limitado"><Copy>Esta sección no está incluida en los permisos de tu vínculo.</Copy><Action label="Volver al inicio" onPress={() => router.replace('/(tabs)')} /></FlowPage>;
  }
  return children;
}
