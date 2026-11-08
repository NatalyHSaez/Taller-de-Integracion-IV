import { Redirect, usePathname, useRouter, useSegments } from "expo-router";
import type { PropsWithChildren } from "react";

import { useAppState } from "@/src/core/presentation/session/use-app-state";

import { Action, Copy, FlowPage } from "../../../../shared/presentation/components/flow-ui";

export function AccessBoundary({ children }: PropsWithChildren) {
  const { user, selectedPatient, permissions, sessionMode } = useAppState();

  const path = usePathname();
  const segments = useSegments();
  const router = useRouter();

  const isAuthRoute = segments[0] === "(auth)";

  const isPublicPage = path === "/invitacion" || path === "/demo";

  const isSelectPatient = path === "/select-patient";

  /*
   * Sin sesión solo pueden utilizarse:
   * - pantallas de autenticación;
   * - invitación;
   * - demo.
   *
   * select-patient requiere usuario autenticado.
   */
  if (!user && (!isAuthRoute || isSelectPatient) && !isPublicPage) {
    return <Redirect href="/(auth)/login" />;
  }

  /*
   * Un usuario ya autenticado no debería volver
   * a Login/Registro.
   *
   * IMPORTANTE:
   * select-patient queda excluida porque un
   * cuidador autenticado puede necesitar pasar
   * por ella.
   */
  if (user && isAuthRoute && !isSelectPatient) {
    return <Redirect href={selectedPatient ? '/(tabs)' : '/(auth)/select-patient'} />;
  }

  /*
   * Para entrar al resto de la aplicación debe
   * existir un paciente seleccionado.
   *
   * Perfil se permite porque corresponde al
   * propio usuario.
   */
  const isRealPatient =
    sessionMode === "backend" && user?.role === "patient";

  const isRealCaregiver =
    sessionMode === "backend" && user?.role === "caregiver";

  const canAccessWithoutPatient =
    isRealPatient ||
    (isRealCaregiver &&
      (path === "/" ||
        path === "/menu" ||
        path === "/vinculos"));

  if (
    user &&
    !isAuthRoute &&
    !isPublicPage &&
    path !== "/perfil" &&
    !selectedPatient &&
    !canAccessWithoutPatient
  ) {
    return <Redirect href="/(auth)/select-patient" />;
  }

  /*
   * Permisos del cuidador.
   */
  if (user?.role === "caregiver" && !isAuthRoute && !isPublicPage) {
    const readPage =
      ["/historial", "/graficos", "/seguimiento"].includes(path) ||
      path.startsWith("/lectura/");

    const alertPage = path.startsWith("/notificaci") || path === "/alertas";

    const unavailablePage =
      path.startsWith("/documentos") || path === "/atencion";

    if (
      (readPage && !permissions.read) ||
      (path === "/registrar-medicion" && !permissions.write) ||
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
            onPress={() => router.replace("/(tabs)")}
          />
        </FlowPage>
      );
    }
  }

  return children;
}
