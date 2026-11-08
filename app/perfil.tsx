import { HealthInformation } from "@/src/modules/monitoring/presentation/components/health-information";
import { ThemedText } from "@/src/shared/presentation/components/themed-text";
import { ThemedView } from "@/src/shared/presentation/components/themed-view";
import { Colors } from "@/src/shared/presentation/theme";
import { useAppState } from "@/src/core/presentation/session/use-app-state";
import { useAuth } from "@/src/modules/identity/presentation/hooks/use-auth";
import { useColorScheme } from "@/src/shared/presentation/hooks/use-color-scheme";
import { useDemo } from "@/src/modules/demo/presentation/use-demo";
import { demo } from "@/src/modules/demo/infrastructure/demo-store";

import { getPatient } from "@/src/modules/identity/infrastructure/identity-api";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { updateMyProfile, profileErrorMessage } from "@/src/modules/identity/application/profile";

import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, } from "react-native";

export default function Profile() {
  
const {
  user: demoUser,
  patients,
  patient: activePatient,
  selectedId,
} = useDemo();

const {
  user: authUser,
  authenticated,
  loading: authLoading,
  signOut,
} = useAuth();

const router = useRouter();
const {
  patients: globalPatients,
  selectedPatient,
  selectPatient,
} = useAppState();

const colorScheme = useColorScheme();

const theme = Colors[colorScheme === "dark" ? "dark" : "light"];

// ==========================================================
// TI4-8: DATOS REALES DEL USUARIO
// ==========================================================

// Mientras se restaura la sesión, no mostramos datos mock.
const isRealSession = authenticated;

// Nombre y correo provenientes de GET /me cuando
// existe una sesión autenticada.
const displayName: string = authLoading
  ? "Cargando..."
  : isRealSession
    ? authUser?.fullName ?? "Usuario"
    : demoUser?.name ?? "Usuario";

const displayEmail: string = authLoading
  ? ""
  : isRealSession
    ? authUser?.email ?? ""
    : demoUser?.email ?? "";

// El rol real tiene prioridad absoluta sobre el mock.
const realRole = authUser?.roles?.[0];

const displayRole: string = authLoading
  ? "Usuario"
  : isRealSession
    ? realRole === "PATIENT"
      ? "Paciente"
      : realRole === "CAREGIVER"
        ? "Cuidador"
        : "Usuario"
    : demoUser?.role === "patient"
      ? "Paciente"
      : demoUser?.role === "caregiver"
        ? "Cuidador"
        : "Usuario";

  // ==========================================================
  // EDICIÓN DEL PERFIL
  // ==========================================================

  const [editing, setEditing] = useState(false);

  const [name, setName] = useState("");

  const [email, setEmail] = useState("");

  /*
   * Actualmente el contrato de usuario no entrega
   * fecha de nacimiento.
   *
   * No inventamos un dato para una cuenta real.
   */
  
const [birthDate, setBirthDate] = useState("");
const [birthDateLoading, setBirthDateLoading] = useState(false);
const [birthDateError, setBirthDateError] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
useEffect(() => {
  let cancelled = false;

  // Cada vez que cambia la cuenta, limpiamos los
  // datos del paciente anterior.
  setBirthDate("");
  setBirthDateError(false);
  setBirthDateLoading(false);

  if (
    !authenticated ||
    authLoading ||
    !authUser?.id ||
    !authUser.roles?.includes("PATIENT")
  ) {
    return;
  }

  setBirthDateLoading(true);

  async function loadPatientProfile() {
    try {
      const patient = await getPatient(authUser!.id);

      if (cancelled) return;

      if (patient.birthDate) {
        const [year, month, day] =
          patient.birthDate.split("-");

        setBirthDate(`${day}/${month}/${year}`);
      }
    } catch (error) {
      if (cancelled) return;

      console.warn(
        "[perfil] No fue posible obtener los datos del paciente:",
        error,
      );

      setBirthDateError(true);
    } finally {
      if (!cancelled) {
        setBirthDateLoading(false);
      }
    }
  }

  void loadPatientProfile();

  return () => {
    cancelled = true;
  };
}, [
  authenticated,
  authLoading,
  authUser?.id,
  authUser?.roles,
]);
  

const displayedPatients = isRealSession
  ? globalPatients
  : patients;

const activeSelectedId = isRealSession
  ? selectedPatient?.id ?? null
  : selectedId;

  const startEditing = () => {
    setName(displayName === "Usuario" ? "" : displayName);
    setEmail(displayEmail);
    setProfileError("");
    setProfileNotice("");
    setEditing(true);
  };

  const cancelEditing = () => {
    if (savingRef.current) return;
    setEditing(false);
    setProfileError("");
  };

  const saveProfile = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setProfileError("");
    try {
      if (authenticated) {
        await updateMyProfile(name);
      } else {
        demo.updateProfile(name.trim(), email.trim());
      }
      setEditing(false);
      setProfileNotice("Perfil actualizado correctamente.");
    } catch (error) {
      setProfileError(profileErrorMessage(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // ==========================================================
  // CERRAR SESIÓN
  // ==========================================================

  const performLogout = async () => {
    try {
      // Limpia cualquier sesión mock.

      // Limpia la sesión real y sus tokens.
      await signOut();

      // Volvemos al login.
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

  const handleLogout = () => {
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

  // ==========================================================
  // AVATAR
  // ==========================================================

  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word: string) => word.charAt(0))
      .join("")
      .toUpperCase() || "U";

  // ==========================================================
  // INTERFAZ
  // ==========================================================

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        
    

        {/* CABECERA */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: theme.surface,

              borderColor: theme.border,
            },
          ]}
        >
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: theme.primarySoft,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.avatarText,
                {
                  color: theme.primary,
                },
              ]}
            >
              {initials}
            </ThemedText>
          </View>

          <View style={styles.profileIdentity}>
            <ThemedText style={styles.profileName}>{displayName}</ThemedText>

            <View
              style={[
                styles.roleBadge,
                {
                  backgroundColor: theme.primarySoft,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="account-heart-outline"
                size={16}
                color={theme.primary}
              />

              <ThemedText
                style={[
                  styles.roleText,
                  {
                    color: theme.primary,
                  },
                ]}
              >
                {displayRole}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* INFORMACIÓN PERSONAL */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>
            Información personal
          </ThemedText>

          <ThemedText
            style={[
              styles.sectionSubtitle,
              {
                color: theme.mutedText,
              },
            ]}
          >
            Datos básicos de tu cuenta
          </ThemedText>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,

              borderColor: theme.border,
            },
          ]}
        >
          {!!profileNotice && <ThemedText accessibilityLiveRegion="polite">{profileNotice}</ThemedText>}
          {!!profileError && <ThemedText accessibilityRole="alert" style={{ color: theme.danger }}>{profileError}</ThemedText>}
          {!editing ? (
            <>
              <InfoRow
                icon="account-outline"
                label="Nombre"
                value={displayName === "Usuario" ? "" : displayName}
                color={theme.primary}
              />

              <Divider color={theme.border} />

              <InfoRow
                icon="email-outline"
                label="Correo electrónico"
                value={displayEmail}
                color={theme.primary}
              />

              <Divider color={theme.border} />
              
              <InfoRow
                icon="calendar-outline"
                label="Fecha de nacimiento"
                value={
                  birthDateLoading
                    ? "Cargando..."
                    : birthDateError
                      ? "No se pudo obtener la fecha"
                      : birthDate
                }
                color={theme.primary}
              />

              <Pressable
                accessibilityRole="button"
                onPress={startEditing}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: theme.primary,
                  },

                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={19}
                  color="#FFFFFF"
                />

                <ThemedText style={styles.primaryButtonText}>
                  Editar información
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <FormField label="Nombre">
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: theme.border,

                      backgroundColor: theme.background,

                      color: theme.text,
                    },
                  ]}
                  accessibilityLabel="Nombre"
                  editable={!saving}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ingresa tu nombre"
                  placeholderTextColor={theme.mutedText}
                  autoCapitalize="words"
                  maxLength={200}
                />
              </FormField>

              <FormField label="Correo electrónico">
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: theme.border,

                      backgroundColor: theme.background,

                      color: theme.text,
                    },
                  ]}
                  accessibilityLabel="Correo electrónico"
                  editable={!authenticated && !saving}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Ingresa tu correo"
                  placeholderTextColor={theme.mutedText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={254}
                />
              </FormField>

              {authenticated ? <ThemedText>Solo puedes editar tu nombre. El correo y la fecha de nacimiento no se modifican desde este perfil.</ThemedText> : <FormField label="Fecha de nacimiento">
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: theme.border,

                      backgroundColor: theme.background,

                      color: theme.text,
                    },
                  ]}
                  editable={!authenticated && !saving}
                  value={birthDate}
                  onChangeText={setBirthDate}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={theme.mutedText}
                  keyboardType="numeric"
                />
              </FormField>}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: saving, busy: saving }}
                disabled={saving}
                onPress={saveProfile}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: theme.primary,
                    opacity: saving ? 0.7 : 1,
                  },
                  pressed && !saving && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  name={saving ? "loading" : "check"}
                  size={20}
                  color="#FFFFFF"
                />

                <ThemedText style={styles.primaryButtonText}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </ThemedText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={cancelEditing}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    borderColor: theme.primary,
                  },

                  pressed && styles.pressed,
                ]}
              >
                <ThemedText
                  style={[
                    styles.secondaryButtonText,
                    {
                      color: theme.primary,
                    },
                  ]}
                >
                  Cancelar
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>

        {/* INFORMACIÓN DE SALUD */}
        {displayRole === "Paciente" && (
          <>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>
                Información de salud
              </ThemedText>

              <ThemedText
                style={[
                  styles.sectionSubtitle,
                  {
                    color: theme.mutedText,
                  },
                ]}
              >
                Condiciones y medicamentos registrados
              </ThemedText>
            </View>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.surface,

                  borderColor: theme.border,
                },
              ]}
            >
              {authenticated ? (
                <ThemedText>La información de salud estará disponible cuando se complete su integración.</ThemedText>
              ) : <HealthInformation />}
            </View>
          </>
        )}

        {/* PACIENTES DEL CUIDADOR */}
        {displayRole === "Cuidador" && (
          <>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>
                Pacientes vinculados
              </ThemedText>

              <ThemedText
                style={[
                  styles.sectionSubtitle,
                  {
                    color: theme.mutedText,
                  },
                ]}
              >
                Pacientes que se encuentran a tu cargo
              </ThemedText>
            </View>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.surface,

                  borderColor: theme.border,
                },
              ]}
            >
              {displayedPatients.length > 0 ? (
                displayedPatients.map((patient) => (
                  <View key={patient.id}>
                  <Pressable
                    key={patient.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Seleccionar a ${patient.name}`}
                    onPress={() => {
                      if (isRealSession) {
                        selectPatient(patient.id);
                        return;
                      }
                      try {
                        demo.select(patient.id);
                      } catch (error) {
                        Alert.alert(
                          "Error al seleccionar paciente",
                          error instanceof Error
                            ? error.message
                            : "No fue posible seleccionar al paciente.",
                        );
                      }
                    }}
                    style={({ pressed }) => [
                      styles.patientRow,

                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.patientAvatar,
                        {
                          backgroundColor: theme.primarySoft,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="account-heart-outline"
                        size={25}
                        color={theme.primary}
                      />
                    </View>

                    <View style={styles.patientInfo}>
                      <ThemedText style={styles.patientName}>
                        {patient.name}
                      </ThemedText>

                      <ThemedText
                        style={[
                          styles.patientDescription,
                          {
                            color:
                              activeSelectedId === patient.id
                                ? theme.primary
                                : theme.mutedText,
                          },
                        ]}
                      >
                        {activeSelectedId === patient.id
                          ? "Paciente activo"
                          : "Toca para seleccionar"}
                      </ThemedText>
                    </View>

                    <MaterialCommunityIcons
                      name={
                        activeSelectedId === patient.id
                          ? "check-circle"
                          : "chevron-right"
                      }
                      size={25}
                      color={
                        activeSelectedId === patient.id
                          ? theme.primary
                          : theme.mutedText
                      }
                    />
                  
                  </Pressable>

                  {activeSelectedId === patient.id && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ver ficha de ${patient.name}`}
                      onPress={() => router.push('/paciente-vinculado')}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: theme.primary, marginTop: 8 },
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="card-account-details-outline"
                        size={20}
                        color={theme.primary}
                      />

                      <ThemedText
                        style={[
                          styles.secondaryButtonText,
                          { color: theme.primary },
                        ]}
                      >
                        Ver ficha del paciente
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
                ))

              ) : (
                <View style={styles.emptyPatients}>
                  <MaterialCommunityIcons
                    name="account-search-outline"
                    size={32}
                    color={theme.mutedText}
                  />

                  <ThemedText
                    style={[
                      styles.emptyPatientsText,
                      {
                        color: theme.mutedText,
                      },
                    ]}
                  >
                    {authenticated ? "La consulta de pacientes vinculados aún no está disponible." : "No tienes pacientes vinculados."}
                  </ThemedText>
                </View>
              )}
            </View>
          </>
        )}

        {/* CUENTA */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Cuenta</ThemedText>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,

              borderColor: theme.border,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/vinculos")}
            style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
          >
            <View style={styles.menuLeft}>
              <MaterialCommunityIcons
                name="account-multiple-outline"
                size={22}
                color={theme.primary}
              />

              <ThemedText style={styles.menuText}>
                Administrar vínculos
              </ThemedText>
            </View>

            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={theme.mutedText}
            />
          </Pressable>

          <Divider color={theme.border} />

          <Pressable
            accessibilityRole="button"
            onPress={handleLogout}
            style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
          >
            <View style={styles.menuLeft}>
              <MaterialCommunityIcons
                name="logout"
                size={22}
                color={theme.danger}
              />

              <ThemedText
                style={[
                  styles.menuText,
                  {
                    color: theme.danger,
                  },
                ]}
              >
                Cerrar sesión
              </ThemedText>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />

      <View style={styles.infoCopy}>
        <ThemedText style={styles.infoLabel}>{label}</ThemedText>

        <ThemedText style={styles.infoValue}>
          {value || "Sin información"}
        </ThemedText>
      </View>
    </View>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.formField}>
      <ThemedText style={styles.formLabel}>{label}</ThemedText>

      {children}
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return (
    <View
      style={[
        styles.divider,
        {
          backgroundColor: color,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 40,
  },

  profileCard: {
    alignItems: "center",

    borderRadius: 20,

    borderWidth: StyleSheet.hairlineWidth,

    flexDirection: "row",

    gap: 16,

    padding: 18,
  },

  avatar: {
    alignItems: "center",

    borderRadius: 32,

    height: 64,

    justifyContent: "center",

    width: 64,
  },

  avatarText: {
    fontSize: 21,

    fontWeight: "800",
  },

  profileIdentity: {
    flex: 1,

    gap: 7,
  },

  profileName: {
    fontSize: 21,

    fontWeight: "800",
  },

  roleBadge: {
    alignItems: "center",

    alignSelf: "flex-start",

    borderRadius: 20,

    flexDirection: "row",

    gap: 5,

    paddingHorizontal: 10,

    paddingVertical: 5,
  },

  roleText: {
    fontSize: 13,

    fontWeight: "700",
  },

  sectionHeader: {
    gap: 3,

    marginTop: 6,
  },

  sectionTitle: {
    fontSize: 19,

    fontWeight: "800",
  },

  sectionSubtitle: {
    fontSize: 13,

    lineHeight: 18,
  },

  card: {
    borderRadius: 18,

    borderWidth: StyleSheet.hairlineWidth,

    gap: 16,

    padding: 18,
  },

  infoRow: {
    alignItems: "center",

    flexDirection: "row",

    gap: 13,
  },

  infoCopy: {
    flex: 1,

    gap: 2,
  },

  infoLabel: {
    fontSize: 12,

    fontWeight: "600",

    opacity: 0.7,
  },

  infoValue: {
    fontSize: 15,

    fontWeight: "600",
  },

  divider: {
    height: StyleSheet.hairlineWidth,

    width: "100%",
  },

  formField: {
    gap: 7,
  },

  formLabel: {
    fontSize: 14,

    fontWeight: "700",
  },

  input: {
    borderRadius: 11,

    borderWidth: 1,

    fontSize: 15,

    paddingHorizontal: 13,

    paddingVertical: 12,
  },

  primaryButton: {
    alignItems: "center",

    borderRadius: 12,

    flexDirection: "row",

    gap: 8,

    justifyContent: "center",

    marginTop: 3,

    paddingHorizontal: 16,

    paddingVertical: 13,
  },

  primaryButtonText: {
    color: "#FFFFFF",

    fontSize: 15,

    fontWeight: "700",
  },

  secondaryButton: {
    alignItems: "center",

    borderRadius: 12,

    borderWidth: 1,

    flexDirection: "row",

    gap: 7,

    justifyContent: "center",

    paddingHorizontal: 14,

    paddingVertical: 12,
  },

  secondaryButtonText: {
    fontSize: 14,

    fontWeight: "700",
  },

  menuRow: {
    alignItems: "center",

    flexDirection: "row",

    justifyContent: "space-between",

    minHeight: 42,
  },

  menuLeft: {
    alignItems: "center",

    flexDirection: "row",

    gap: 12,
  },

  menuText: {
    fontSize: 15,

    fontWeight: "700",
  },

  pressed: {
    opacity: 0.65,
  },

  patientRow: {
    alignItems: "center",

    flexDirection: "row",

    minHeight: 58,
  },

  patientAvatar: {
    alignItems: "center",

    borderRadius: 24,

    height: 48,

    justifyContent: "center",

    width: 48,
  },

  patientInfo: {
    flex: 1,

    gap: 3,

    marginLeft: 13,
  },

  patientName: {
    fontSize: 16,

    fontWeight: "800",
  },

  patientDescription: {
    fontSize: 13,
  },

  emptyPatients: {
    alignItems: "center",

    gap: 8,

    paddingVertical: 20,
  },

  emptyPatientsText: {
    fontSize: 14,

    textAlign: "center",
  },
});
