import { HealthInformation } from "@/components/profile/health-information";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDemo } from "@/hooks/use-demo";
import { useAppState } from "@/hooks/use-app-state";
import { demo } from "@/services/demo-store";
import { authService } from "@/services/authservice";
import { getApiErrorMessage } from "@/services/errors";

import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useState } from "react";

import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

export default function Profile() {
  const { user: demoUser } = useDemo();
  const { patients, sessionMode, selectPatient, patientsLoading, patientsError } = useAppState();
  const [selectError, setSelectError] = useState("");

  const { user: authUser, authenticated, signOut } = useAuth();

  const router = useRouter();

  const colorScheme = useColorScheme();

  const theme = Colors[colorScheme === "dark" ? "dark" : "light"];

  // ==========================================================
  // DATOS DEL USUARIO
  // ==========================================================

  /*
   * Si existe una sesión real utilizamos primero
   * los datos entregados por /me.
   *
   * Si estamos utilizando una cuenta mock,
   * recurrimos a demo-store.
   */
  const displayName: string =
    authUser?.fullName ?? demoUser?.name ?? "Usuario";

  const displayEmail: string = authUser?.email ?? demoUser?.email ?? "";

  const realRole = authUser?.roles?.[0];

  const displayRole: string =
    realRole === "PATIENT" || (sessionMode === "mock" && demoUser?.role === "patient")
      ? "Paciente"
      : realRole === "CAREGIVER" || (sessionMode === "mock" && demoUser?.role === "caregiver")
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

  const startEditing = () => {
    setName(displayName === "Usuario" ? "" : displayName);
    setEmail(displayEmail);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);

    setName("");
    setEmail("");
  };

  const saveProfile = async () => {
    try {
      if (authenticated) {
        // PATCH /me solo admite fullName: correo y fecha de nacimiento son de solo lectura.
        await authService.updateName(name);
      } else {
        demo.updateProfile(name.trim(), email.trim());
      }
      setEditing(false);
      Alert.alert("Perfil actualizado", "Tus datos se guardaron correctamente.");
    } catch (cause) {
      Alert.alert("Error", getApiErrorMessage(cause, "No se pudieron guardar los cambios."));
    }
  };

  // ==========================================================
  // CERRAR SESIÓN
  // ==========================================================

  const performLogout = async () => {
    try {
      // El servicio revoca refresh y limpia cualquier sesión mock o real.
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
                value={birthDate}
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
                  value={name}
                  onChangeText={setName}
                  placeholder="Ingresa tu nombre"
                  placeholderTextColor={theme.mutedText}
                  autoCapitalize="words"
                  maxLength={100}
                />
              </FormField>

              <FormField label={authenticated ? "Correo electrónico (no editable)" : "Correo electrónico"}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: theme.border,

                      backgroundColor: theme.background,

                      color: theme.text,
                    },
                  ]}
                  value={email}
                  onChangeText={setEmail}
                  editable={!authenticated}
                  placeholder="Ingresa tu correo"
                  placeholderTextColor={theme.mutedText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={254}
                />
              </FormField>

              <FormField label={authenticated ? "Fecha de nacimiento (no editable)" : "Fecha de nacimiento"}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: theme.border,

                      backgroundColor: theme.background,

                      color: theme.text,
                    },
                  ]}
                  value={birthDate}
                  onChangeText={setBirthDate}
                  editable={!authenticated}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={theme.mutedText}
                  keyboardType="numeric"
                />
              </FormField>

              <Pressable
                accessibilityRole="button"
                onPress={saveProfile}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: theme.primary,
                  },

                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={20}
                  color="#FFFFFF"
                />

                <ThemedText style={styles.primaryButtonText}>
                  Guardar cambios
                </ThemedText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
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
        {displayRole === "Paciente" && sessionMode === "mock" && (
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
              <HealthInformation />
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
              {!!selectError && <ThemedText>{selectError}</ThemedText>}
              {!!patientsError && <ThemedText>{patientsError}</ThemedText>}
              {patientsLoading && <ThemedText>Consultando tus pacientes...</ThemedText>}
              {patients.length > 0 ? (
                patients.map((patient) => (
                  <Pressable
                    key={patient.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Seleccionar a ${patient.name}`}
                    onPress={() => {
                      /*
                       * Guardamos el paciente
                       * seleccionado.
                       */
                      void selectPatient(patient.id)
                        .then(() => router.replace('/(tabs)'))
                        .catch((cause) => setSelectError(getApiErrorMessage(cause)));
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
                            color: theme.mutedText,
                          },
                        ]}
                      >
                        Paciente vinculado
                      </ThemedText>
                    </View>

                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={25}
                      color={theme.mutedText}
                    />
                  </Pressable>
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
                    No tienes pacientes vinculados.
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
