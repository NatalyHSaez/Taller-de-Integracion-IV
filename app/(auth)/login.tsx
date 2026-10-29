import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandColors, Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDemo } from "@/hooks/use-demo";
import { appState } from "@/services/app-state";
import { authService } from "@/services/authservice";
import { demo } from "@/services/demo-store";
import { getApiErrorMessage } from "@/services/errors";

export default function LoginScreen() {
  const router = useRouter();
  const { pendingToken } = useDemo();
  const theme = Colors[useColorScheme() === "dark" ? "dark" : "light"];

  const passwordInput = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(
    null,
  );

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  async function submit() {
    if (loading) {
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Ingresa tu correo electrónico.");
      return;
    }

    if (!password) {
      setError("Ingresa tu contraseña.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      /*
       * authService será el punto único de autenticación.
       *
       * Él decidirá si corresponde utilizar:
       * - una cuenta mock; o
       * - el backend real.
       */
      await authService.login(cleanEmail, password, demoMode ? 'mock' : 'backend');

      // authService.login ya consulta /me para cuentas reales y publica
      // el usuario en la única sesión observable de la app.

      // El hook observa authSession; no requiere otro setUser local.
      const globalState = appState.snapshot();

      /*
       * Si existe una invitación pendiente y el usuario
       * autenticado es cuidador, continuamos ese flujo.
       */
      if (
        demoMode && demo.snapshot().pendingToken &&
        globalState.user?.role === "caregiver"
      ) {
        router.replace("/invitacion");
        return;
      }

      /*
       * Si ya existe un paciente seleccionado, entramos
       * directamente a la aplicación.
       */
      if (globalState.selectedPatient) {
        router.replace("/(tabs)");
        return;
      }

      /*
       * Si el cuidador todavía debe seleccionar paciente,
       * lo enviamos a esa pantalla.
       */
      router.replace("/(auth)/select-patient");
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No fue posible iniciar sesión."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View
              pointerEvents="none"
              style={[
                styles.decoration,
                { backgroundColor: theme.primarySoft },
              ]}
            />

            <View style={styles.brand}>
              <MaterialCommunityIcons
                color={theme.primary}
                name="home-heart"
                size={27}
              />
              <Text style={[styles.brandName, { color: theme.primary }]}>
                Domicilia
              </Text>
            </View>

            <View style={styles.heading}>
              <Text
                accessibilityRole="header"
                style={[styles.title, { color: theme.text }]}
              >
                Bienvenido a{"\n"}Domicilia
              </Text>

              <Text style={[styles.subtitle, { color: theme.mutedText }]}>
                Ingresa con tu correo y contraseña.
              </Text>
            </View>

            {pendingToken && (
              <View
                style={[
                  styles.invitationNotice,
                  {
                    backgroundColor: theme.primarySoft,
                    borderColor: theme.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  color={theme.primary}
                  name="link-variant"
                  size={19}
                />

                <Text style={[styles.invitationText, { color: theme.text }]}>
                  Tienes una invitación pendiente. La retomaremos al iniciar
                  sesión como cuidador.
                </Text>
              </View>
            )}

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Correo electrónico
                </Text>

                <View
                  style={[
                    styles.inputShell,
                    {
                      backgroundColor:
                        focusedField === "email"
                          ? theme.surface
                          : theme.surfaceMuted,
                      borderColor:
                        focusedField === "email" ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    color={theme.icon}
                    name="email-outline"
                    size={21}
                  />

                  <TextInput
                    accessibilityLabel="Correo electrónico"
                    autoCapitalize="none"
                    autoComplete="email"
                    editable={!loading}
                    keyboardType="email-address"
                    onBlur={() => setFocusedField(null)}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField("email")}
                    onSubmitEditing={() => passwordInput.current?.focus()}
                    placeholder="ejemplo@correo.com"
                    placeholderTextColor={theme.placeholder}
                    returnKeyType="next"
                    style={[styles.input, { color: theme.text }]}
                    textContentType="emailAddress"
                    value={email}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Contraseña
                </Text>

                <View
                  style={[
                    styles.inputShell,
                    {
                      backgroundColor:
                        focusedField === "password"
                          ? theme.surface
                          : theme.surfaceMuted,
                      borderColor:
                        focusedField === "password"
                          ? theme.primary
                          : theme.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    color={theme.icon}
                    name="lock-outline"
                    size={21}
                  />

                  <TextInput
                    ref={passwordInput}
                    accessibilityLabel="Contraseña"
                    autoCapitalize="none"
                    autoComplete="current-password"
                    editable={!loading}
                    onBlur={() => setFocusedField(null)}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField("password")}
                    onSubmitEditing={submit}
                    placeholder="••••••••"
                    placeholderTextColor={theme.placeholder}
                    returnKeyType="done"
                    secureTextEntry={!passwordVisible}
                    style={[styles.input, { color: theme.text }]}
                    textContentType="password"
                    value={password}
                  />

                  <Pressable
                    accessibilityLabel={
                      passwordVisible
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                    accessibilityRole="button"
                    disabled={loading}
                    hitSlop={8}
                    onPress={() => setPasswordVisible(!passwordVisible)}
                    style={styles.eyeButton}
                  >
                    <MaterialCommunityIcons
                      color={passwordVisible ? theme.primary : theme.icon}
                      name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                      size={22}
                    />
                  </Pressable>
                </View>
              </View>

              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: demoMode }}
                disabled={loading}
                onPress={() => setDemoMode((current) => !current)}
                style={{ paddingVertical: 10 }}
              >
                <Text style={{ color: theme.text, fontSize: 14 }}>
                  {demoMode ? '☑' : '☐'} Usar una cuenta de demostración (sin backend)
                </Text>
              </Pressable>

              {!!error && (
                <Text style={[styles.error, { color: theme.danger }]}>
                  {error}
                </Text>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={submit}
                style={({ pressed }) => [
                  styles.submitButton,
                  {
                    backgroundColor: theme.primary,
                    shadowColor: BrandColors.shadow,
                  },
                  pressed && !loading && styles.pressed,
                  loading && styles.disabled,
                ]}
              >
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={theme.onPrimary} size="small" />
                    <Text
                      style={[styles.submitText, { color: theme.onPrimary }]}
                    >
                      Iniciando sesión...
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.submitText, { color: theme.onPrimary }]}>
                    Iniciar sesión
                  </Text>
                )}
              </Pressable>
            </View>

            <View style={styles.newAccount}>
              <Text
                style={[styles.newAccountTitle, { color: theme.mutedText }]}
              >
                ¿Nuevo en Domicilia?
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(auth)/activate")}
                style={({ pressed }) => [
                  styles.accountLink,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  color={theme.primary}
                  name="account-heart-outline"
                  size={18}
                />

                <Text
                  style={[styles.accountLinkText, { color: theme.primary }]}
                >
                  Activar cuenta de paciente
                </Text>
              </Pressable>

              <View
                style={[styles.linkDivider, { backgroundColor: theme.border }]}
              />

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(auth)/register")}
                style={({ pressed }) => [
                  styles.accountLink,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  color={theme.primary}
                  name="account-plus-outline"
                  size={18}
                />

                <Text
                  style={[styles.accountLinkText, { color: theme.primary }]}
                >
                  Crear cuenta de cuidador
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: {
    alignSelf: "center",
    flexGrow: 1,
    maxWidth: 460,
    overflow: "hidden",
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 26,
    width: "100%",
  },
  decoration: {
    borderRadius: 190,
    height: 280,
    left: -150,
    opacity: 0.5,
    position: "absolute",
    top: -156,
    width: 280,
  },
  brand: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    marginBottom: 28,
  },
  brandName: { fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
  heading: { marginBottom: 32 },
  title: {
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 37,
    marginBottom: 8,
  },
  subtitle: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  invitationNotice: {
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
    padding: 13,
  },
  invitationText: { flex: 1, fontSize: 13, lineHeight: 18 },
  form: { gap: 19 },
  field: { gap: 7 },
  label: { fontSize: 14, fontWeight: "700", marginLeft: 3 },
  inputShell: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 55,
    paddingLeft: 16,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  eyeButton: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  error: { fontSize: 13, lineHeight: 19 },
  submitButton: {
    alignItems: "center",
    borderRadius: 16,
    elevation: 4,
    justifyContent: "center",
    minHeight: 55,
    marginTop: 4,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  submitText: { fontSize: 16, fontWeight: "800" },
  loadingRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  disabled: { opacity: 0.7 },
  newAccount: { alignItems: "center", gap: 11, marginTop: 31 },
  newAccountTitle: { fontSize: 14, fontWeight: "500", marginBottom: 2 },
  accountLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 30,
  },
  accountLinkText: { fontSize: 15, fontWeight: "700" },
  linkDivider: { height: 1, marginVertical: 1, width: 48 },
  pressed: { opacity: 0.72 },
});
