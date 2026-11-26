import { Redirect, useRouter } from "expo-router";

import { Alert, Platform } from "react-native";

import { Action, Card, Copy, FlowPage } from "@/src/shared/presentation/components/flow-ui";
import { LeavePatientAction } from "@/src/modules/relationships/presentation/components/leave-patient-action";
import { LINK_TYPE_LABELS, takeLinkConfirmation } from "@/src/modules/relationships/application/link-codes";

import { useAppState } from "@/src/core/presentation/session/use-app-state";
import { useAuth } from "@/src/modules/identity/presentation/hooks/use-auth";
import { useDemo } from "@/src/modules/demo/presentation/use-demo";
import { appState } from "@/src/core/application/session/app-state";
import { authService } from "@/src/modules/identity/application/authservice";
import { useEffect, useState } from "react";

export default function SelectPatient() {
  const router = useRouter();

  const { user, patients, selectPatient, sessionMode } = useAppState();

  const { relations, profiles } = useDemo();

  const { setUser } = useAuth();
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientsError] = useState(false);
  // Agregado: confirmación del vínculo recién creado con un código.
  const [linkConfirmation] = useState(() => takeLinkConfirmation());

  useEffect(() => {
    if (!user || user.source !== "backend" || user.role !== "caregiver") {
      return;
    }

    let cancelled = false;

    setPatientsLoading(true);
    setPatientsError(false);

    appState
      .loadRealPatients()
      .catch((error) => {
        console.error("Error consultando pacientes:", error);

        if (!cancelled) {
          setPatientsError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPatientsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.source, user?.role]);

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
      {linkConfirmation && (
        <Card>
          <Copy>
            ✓ Te vinculaste con {linkConfirmation.patientName} como{" "}
            {LINK_TYPE_LABELS[linkConfirmation.relationshipType] ?? "acompañante"}.
          </Copy>
          <Copy>
            {linkConfirmation.relationshipType === "CAREGIVER"
              ? "El paciente puede ajustar tus permisos desde su pantalla de Vínculos."
              : "Ya puedes ver la información clínica del paciente."}
          </Copy>
        </Card>
      )}

      {patientsLoading && (
        <Card>
          <Copy>Cargando pacientes vinculados...</Copy>
        </Card>
      )}

      {patientsError && (
        <Card>
          <Copy>
            No se pudieron cargar los pacientes. Intenta nuevamente más tarde.
          </Copy>
        </Card>
      )}
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

          {user.source === "backend" && (
            <LeavePatientAction
              patientId={patient.id}
              patientName={patient.name}
              onLeft={() => appState.loadRealPatients()}
            />
          )}
        </Card>
      ))}

      {(user.source === "backend" ? [] : relations)
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
      {user.source === "backend" && patients.length === 0 && !patientsLoading && !patientsError && (
        <Action
          secondary
          label="Ir a mi perfil"
          onPress={() => router.replace("/perfil")}
        />
      )}

      <Action secondary label="Cerrar sesión" onPress={confirmLogout} />

      {sessionMode !== 'backend' && <Action
        secondary
        label="Ver guía de demostración"
        onPress={() => router.push("/demo")}
      />}
    </FlowPage>
  );
}
