import { Redirect, useRouter } from "expo-router";

import { Alert, Platform } from "react-native";

import { Action, Card, Copy, FlowPage } from "@/components/flow-ui";

import { useAppState } from "@/hooks/use-app-state";
import { useAuth } from "@/hooks/use-auth";
import { useDemo } from "@/hooks/use-demo";
import { authService } from "@/services/authservice";

export default function SelectPatient() {
  const router = useRouter();

  const { user, patients, selectPatient } = useAppState();

  const { relations, profiles } = useDemo();

  const { setUser } = useAuth();

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  /*
   * Ejecuta realmente el cierre de sesión.
   */
  const performLogout = async () => {
    try {
      /*
       * authService.logout() se encarga de:
       * - cerrar sesión backend cuando corresponde;
       * - eliminar tokens;
       * - limpiar authSession;
       * - limpiar caché;
       * - limpiar demo-store.
       */
      await authService.logout();

      /*
       * También sincronizamos AuthProvider.
       */
      setUser(null);

      router.replace("/(auth)/login");
    } catch (error) {
      console.log("Error cerrando sesión:", error);

      if (Platform.OS === "web") {
        window.alert("No se pudo cerrar la sesión correctamente.");
      } else {
        Alert.alert("Error", "No se pudo cerrar la sesión correctamente.");
      }
    }
  };

  /*
   * Pide confirmación antes de cerrar sesión.
   */
  const confirmLogout = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("¿Deseas cerrar tu sesión?");

      if (confirmed) {
        void performLogout();
      }

      return;
    }

    Alert.alert("Cerrar sesión", "¿Deseas cerrar tu sesión?", [
      {
        text: "Cancelar",
        style: "cancel",
      },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: () => void performLogout(),
      },
    ]);
  };

  return (
    <FlowPage
      title={
        patients.length
          ? "¿A quién acompañas hoy?"
          : "Aún no tienes pacientes vinculados"
      }
      subtitle={`Hola, ${user.name}. Solo puedes acceder a vínculos aprobados.`}
    >
      {patients.map((patient) => (
        <Card key={patient.id}>
          <Copy>{patient.name}</Copy>

          <Action
            label="Acompañar a este paciente"
            onPress={() => {
              selectPatient(patient.id);

              router.replace("/(tabs)");
            }}
          />
        </Card>
      ))}

      {relations
        .filter(
          (relation) =>
            relation.caregiverId === user.id && relation.status !== "approved",
        )
        .map((relation) => {
          const profile = profiles.find(
            (item) => item.id === relation.patientId,
          );

          return (
            <Card key={relation.id}>
              <Copy>{profile?.name ?? "Paciente"}</Copy>

              <Copy>
                {relation.status === "pending"
                  ? "Solicitud pendiente de aprobación. Todavía no tienes acceso a información clínica."
                  : relation.status === "rejected"
                    ? "El paciente rechazó la solicitud."
                    : "El paciente retiró tu acceso."}
              </Copy>
            </Card>
          );
        })}

      <Action
        label="Escanear QR o abrir invitación"
        onPress={() => router.push("/invitacion")}
      />

      <Action secondary label="Cerrar sesión" onPress={confirmLogout} />

      <Action
        secondary
        label="Ver guía de demostración"
        onPress={() => router.push("/demo")}
      />
    </FlowPage>
  );
}
