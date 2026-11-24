import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import { appState } from "@/src/core/application/session/app-state";
import { useAppState } from "@/src/core/presentation/session/use-app-state";
import {
  consumeLinkCode,
  describeLinkCodeError,
  normalizeLinkCode,
} from "@/src/modules/relationships/application/link-codes";
import type { ConsumeLinkCodeResponse } from "@/src/modules/relationships/domain/relationships";
import {
  Action,
  Card,
  Copy,
  Field,
  FlowPage,
} from "@/src/shared/presentation/components/flow-ui";

/** La vinculación real nunca utiliza invitaciones ni pacientes simulados. */
function RealInvitationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    token?: string | string[];
    code?: string | string[];
  }>();
  const { user } = useAppState();
  const initialCode = params.code ?? params.token;
  const [code, setCode] = useState(
    Array.isArray(initialCode) ? (initialCode[0] ?? "") : (initialCode ?? ""),
  );
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState<ConsumeLinkCodeResponse | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanHandled = useRef(false);

  async function openScanner() {
    setError("");
    scanHandled.current = false;
    try {
      const permission = cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();
      if (!permission.granted) {
        setError(
          "Debes permitir el uso de la cámara para escanear el QR. También puedes escribir el código.",
        );
        return;
      }
      setScannerOpen(true);
    } catch {
      setError(
        "No fue posible abrir la cámara. Introduce el código manualmente.",
      );
    }
  }

  async function refreshPatients() {
    setRefreshError("");
    try {
      await appState.loadRealPatients();
      router.replace("/(auth)/select-patient");
    } catch {
      // El POST de vinculación YA fue confirmado: nunca volvemos a consumir el código.
      setRefreshError(
        "El vínculo se creó, pero no pudimos actualizar la lista de pacientes. Intenta cargarla nuevamente.",
      );
    }
  }

  async function linkPatient() {
    if (busy || linked || user?.role !== "caregiver") return;
    const normalized = normalizeLinkCode(code);
    if (!normalized) {
      setError("Escribe o escanea el código de vinculación.");
      return;
    }

    setBusy(true);
    setError("");
    setScannerOpen(false);
    try {
      const relationship = await consumeLinkCode(normalized);
      setLinked(relationship);
      await refreshPatients();
    } catch (cause) {
      setError(describeLinkCodeError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FlowPage
      title="Vincular paciente"
      subtitle="Usa el código temporal que te entregó el paciente."
    >
      {!user ? (
        <>
          <Copy>
            Debes iniciar sesión como cuidador para utilizar un código real.
          </Copy>
          <Action
            label="Iniciar sesión"
            onPress={() => router.push("/(auth)/login")}
          />
        </>
      ) : user.role !== "caregiver" ? (
        <Copy>Esta opción está disponible para cuentas de cuidador.</Copy>
      ) : linked ? (
        <Card>
          <Copy>Te vinculaste con {linked.patientName}.</Copy>
          <Copy>
            El código ya fue utilizado y no es necesario ingresarlo nuevamente.
          </Copy>
          {!!refreshError && <Copy>{refreshError}</Copy>}
          <Action
            label={
              refreshError
                ? "Reintentar carga de pacientes"
                : "Ver mis pacientes"
            }
            onPress={() => void refreshPatients()}
          />
        </Card>
      ) : (
        <>
          <Field
            label="Código de vinculación"
            value={code}
            onChangeText={(value) => {
              setCode(value);
              setError("");
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Código de 6 caracteres"
          />
          <Action
            secondary
            label={scannerOpen ? "Cerrar cámara" : "Escanear código QR"}
            disabled={busy}
            onPress={() => {
              if (scannerOpen) setScannerOpen(false);
              else void openScanner();
            }}
          />
          {scannerOpen && (
            <View style={{ height: 300, overflow: "hidden", borderRadius: 12 }}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={({ data }) => {
                  if (scanHandled.current) return;
                  scanHandled.current = true;
                  setCode(normalizeLinkCode(data));
                  setScannerOpen(false);
                  setError("");
                }}
              />
            </View>
          )}
          {!!error && (
            <Card>
              <Copy>{error}</Copy>
            </Card>
          )}
          <Action
            label={busy ? "Vinculando…" : "Vincular paciente"}
            disabled={busy || !normalizeLinkCode(code)}
            onPress={() => void linkPatient()}
          />
          <Copy>
            El código vence a los 5 minutos y solo puede utilizarse una vez.
          </Copy>
        </>
      )}
      <Action
        secondary
        label="Volver"
        onPress={() =>
          router.replace(
            user
              ? user.role === "caregiver"
                ? "/(auth)/select-patient"
                : "/(tabs)"
              : "/(auth)/login",
          )
        }
      />
    </FlowPage>
  );
}

export default function InvitationScreen() {
  return <RealInvitationScreen />;
}
