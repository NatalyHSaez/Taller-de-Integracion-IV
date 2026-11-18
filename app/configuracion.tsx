import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useRouter } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { useAppState } from '@/src/core/presentation/session/use-app-state';
import { AppHeader } from '@/src/modules/dashboard/presentation/components/app-header';
import { demo } from '@/src/modules/demo/infrastructure/demo-store';
import { useDemo } from '@/src/modules/demo/presentation/use-demo';
import { authService } from '@/src/modules/identity/application/authservice';
import { Field } from '@/src/shared/presentation/components/flow-ui';
import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';
import { AccentColors, type AppTheme, BrandColors, Colors, StatusColors } from '@/src/shared/presentation/theme';

/**
 * Configuración con el mismo lenguaje visual que Seguimiento: cabecera azul y
 * grupos de opciones en tarjetas blancas (ícono en recuadro de color, título,
 * descripción y control a la derecha).
 */

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Tone = { background: string; foreground: string };

function Section({ title, children, theme }: { title: string; children: ReactNode; theme: AppTheme }) {
  return (
    <View style={styles.section}>
      <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>
    </View>
  );
}

function Divider({ theme }: { theme: AppTheme }) {
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

function Row({
  icon,
  tone,
  title,
  description,
  right,
  onPress,
  accessibilityLabel,
  theme,
}: {
  icon: IconName;
  tone: Tone;
  title: string;
  description?: string;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  theme: AppTheme;
}) {
  const content = (
    <>
      <View style={[styles.iconBox, { backgroundColor: tone.background }]}>
        <MaterialCommunityIcons name={icon} size={23} color={tone.foreground} />
      </View>
      <View style={styles.rowCopy}>
        <ThemedText style={styles.rowTitle}>{title}</ThemedText>
        {!!description && (
          <ThemedText style={[styles.rowDescription, { color: theme.mutedText }]}>{description}</ThemedText>
        )}
      </View>
      {right}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

function Chevron({ open, theme }: { open: boolean; theme: AppTheme }) {
  return <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={24} color={theme.primary} />;
}

function Feedback({ error, message, theme }: { error: string; message: string; theme: AppTheme }) {
  if (!error && !message) return null;
  const tone = error ? StatusColors.danger : StatusColors.normal;
  return (
    <View accessibilityRole="alert" style={[styles.feedback, { backgroundColor: tone.background }]}>
      <MaterialCommunityIcons name={error ? 'alert-circle-outline' : 'check-circle-outline'} size={18} color={tone.foreground} />
      <ThemedText style={[styles.feedbackText, { color: tone.foreground }]}>{error || message}</ThemedText>
    </View>
  );
}

function PrimaryButton({ label, icon, onPress, theme }: { label: string; icon: IconName; onPress: () => void; theme: AppTheme }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
      <MaterialCommunityIcons name={icon} size={19} color={theme.onPrimary} />
      <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.buttonText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Solo en el modo demostración: el backend actual no permite cambiar correo ni contraseña. */
function EditarCorreo({ theme }: { theme: AppTheme }) {
  const { user } = useDemo();
  const [email, setEmail] = useState(user?.email ?? '');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const guardar = () => {
    try {
      demo.updateEmail(email);
      setMensaje('Correo actualizado.');
      setError('');
    } catch (e) {
      setError((e as Error).message);
      setMensaje('');
    }
  };

  return (
    <View style={styles.form}>
      <ThemedText style={styles.formTitle}>Correo electrónico</ThemedText>
      <Field
        label="Correo"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Feedback error={error} message={mensaje} theme={theme} />
      <PrimaryButton label="Guardar correo" icon="content-save-outline" onPress={guardar} theme={theme} />
    </View>
  );
}

function CambiarContrasena({ theme }: { theme: AppTheme }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const guardar = () => {
    try {
      if (nueva !== repetir) throw new Error('Las contraseñas nuevas no coinciden.');
      demo.updatePassword(actual, nueva);
      setMensaje('Contraseña actualizada.');
      setError('');
      setActual('');
      setNueva('');
      setRepetir('');
    } catch (e) {
      setError((e as Error).message);
      setMensaje('');
    }
  };

  return (
    <View style={styles.form}>
      <ThemedText style={styles.formTitle}>Cambiar contraseña</ThemedText>
      <Field label="Contraseña actual" value={actual} onChangeText={setActual} secureTextEntry />
      <Field label="Contraseña nueva" value={nueva} onChangeText={setNueva} secureTextEntry />
      <Field label="Repite la contraseña nueva" value={repetir} onChangeText={setRepetir} secureTextEntry />
      <Feedback error={error} message={mensaje} theme={theme} />
      <PrimaryButton label="Guardar contraseña" icon="lock-check-outline" onPress={guardar} theme={theme} />
    </View>
  );
}

export default function Configuracion() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const purple = AccentColors[isDark ? 'dark' : 'light'];
  const { user, sessionMode } = useAppState();
  const { notificationPrefs } = useDemo();
  const isBackend = sessionMode === 'backend';

  const [editandoCredenciales, setEditandoCredenciales] = useState(false);
  const [mostrarAyuda, setMostrarAyuda] = useState(false);
  const [mostrarAcercaDe, setMostrarAcercaDe] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  const primaryTone: Tone = { background: theme.primarySoft, foreground: theme.primary };
  const purpleTone: Tone = { background: purple.purpleSoft, foreground: purple.purple };
  const initials = (user?.name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  const cerrarSesion = () => {
    if (cerrando) return;
    setCerrando(true);
    void authService
      .logout()
      .then(() => router.replace('/(auth)/login'))
      .catch(() => {
        setCerrando(false);
        console.error('No se pudo limpiar el almacenamiento de sesion.');
      });
  };

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Configuración',
          header: () => <AppHeader back title="Configuración" subtitle="Preferencias y privacidad" />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Cabecera (mismas medidas que Seguimiento) */}
        <View style={styles.hero}>
          <View style={styles.heroDecorationTop} />
          <View style={styles.heroDecorationBottom} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <ThemedText lightColor={BrandColors.onPrimaryEyebrow} darkColor={BrandColors.onPrimaryEyebrow} style={styles.eyebrow}>
                TU CUENTA
              </ThemedText>
              <ThemedText lightColor={BrandColors.onPrimary} darkColor={BrandColors.onPrimary} style={styles.heroTitle}>
                Configuración
              </ThemedText>
            </View>
            <View style={styles.avatar}>
              {initials ? (
                <ThemedText lightColor={BrandColors.onPrimary} darkColor={BrandColors.onPrimary} style={styles.avatarText}>
                  {initials}
                </ThemedText>
              ) : (
                <MaterialCommunityIcons name="account-cog-outline" size={30} color={BrandColors.onPrimary} />
              )}
            </View>
          </View>
          {!!user && (
            <View style={styles.userRow}>
              <MaterialCommunityIcons name="account-circle-outline" size={19} color={BrandColors.onPrimary} />
              <View style={styles.flex}>
                <ThemedText lightColor={BrandColors.onPrimary} darkColor={BrandColors.onPrimary} style={styles.userName} numberOfLines={1}>
                  {user.name}
                </ThemedText>
                {!!user.email && (
                  <ThemedText lightColor={BrandColors.onPrimaryMuted} darkColor={BrandColors.onPrimaryMuted} style={styles.userEmail} numberOfLines={1}>
                    {user.email}
                  </ThemedText>
                )}
              </View>
              <View style={styles.rolePill}>
                <ThemedText lightColor={BrandColors.onPrimary} darkColor={BrandColors.onPrimary} style={styles.roleText}>
                  {user.role === 'patient' ? 'Paciente' : 'Cuidador'}
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        <Section title="Avisos en este dispositivo" theme={theme}>
          <Row
            theme={theme}
            icon="heart-pulse"
            tone={primaryTone}
            title="Mediciones guardadas"
            description="Aviso cuando se registra una medición."
            right={
              <Switch
                accessibilityLabel="Mediciones guardadas"
                value={notificationPrefs.mediciones}
                onValueChange={(value) => demo.setNotificationPrefs({ mediciones: value })}
                thumbColor={BrandColors.onPrimary}
                {...({ activeThumbColor: BrandColors.onPrimary } as object)}
                trackColor={{ true: theme.primary, false: theme.border }}
              />
            }
          />
          <Divider theme={theme} />
          <Row
            theme={theme}
            icon="account-multiple-outline"
            tone={purpleTone}
            title="Vínculos y permisos"
            description="Solicitudes, aprobaciones y revocaciones."
            right={
              <Switch
                accessibilityLabel="Vínculos y permisos"
                value={notificationPrefs.vinculos}
                onValueChange={(value) => demo.setNotificationPrefs({ vinculos: value })}
                thumbColor={BrandColors.onPrimary}
                {...({ activeThumbColor: BrandColors.onPrimary } as object)}
                trackColor={{ true: theme.primary, false: theme.border }}
              />
            }
          />
        </Section>

        <Section title="Cuenta" theme={theme}>
          {isBackend ? (
            <Row
              theme={theme}
              icon="shield-account-outline"
              tone={primaryTone}
              title="Datos de inicio de sesión"
              description="El correo y la contraseña de tu cuenta todavía no se pueden cambiar desde la app."
            />
          ) : (
            <>
              <Row
                theme={theme}
                icon="shield-account-outline"
                tone={primaryTone}
                title="Datos de inicio de sesión"
                description="Correo y contraseña de esta demostración."
                accessibilityLabel={editandoCredenciales ? 'Ocultar datos de inicio de sesión' : 'Cambiar datos de inicio de sesión'}
                onPress={() => setEditandoCredenciales(!editandoCredenciales)}
                right={<Chevron open={editandoCredenciales} theme={theme} />}
              />
              {editandoCredenciales && (
                <View style={[styles.expanded, { borderTopColor: theme.border }]}>
                  <EditarCorreo theme={theme} />
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <CambiarContrasena theme={theme} />
                </View>
              )}
            </>
          )}
        </Section>

        <Section title="Privacidad y datos" theme={theme}>
          <Row
            theme={theme}
            icon="lock-outline"
            tone={StatusColors.normal}
            title={isBackend ? 'Tus datos en el servidor' : 'Datos solo en este dispositivo'}
            description={
              isBackend
                ? 'Tus mediciones y vínculos se guardan en el servidor de Domicilia. Solo las personas que autorizas en Vínculos pueden verlos.'
                : 'En la demostración, los datos viven en la memoria de la app y se reinician al recargarla. No se envían a ningún servidor.'
            }
          />
        </Section>

        <Section title="Ayuda e información" theme={theme}>
          <Row
            theme={theme}
            icon="help-circle-outline"
            tone={primaryTone}
            title="¿Cómo funciona Domicilia?"
            onPress={() => setMostrarAyuda(!mostrarAyuda)}
            right={<Chevron open={mostrarAyuda} theme={theme} />}
          />
          {mostrarAyuda && (
            <ThemedText style={[styles.expandedText, { color: theme.mutedText }]}>
              Domicilia te ayuda a llevar el registro de tu salud y compartirlo con las personas que tú elijas. Invita a un
              cuidador o médico desde Vínculos, y decide tú qué puede ver o hacer cada uno.
            </ThemedText>
          )}
          <Divider theme={theme} />
          <Row
            theme={theme}
            icon="information-outline"
            tone={purpleTone}
            title="Acerca de Domicilia"
            onPress={() => setMostrarAcercaDe(!mostrarAcercaDe)}
            right={<Chevron open={mostrarAcercaDe} theme={theme} />}
          />
          {mostrarAcercaDe && (
            <ThemedText style={[styles.expandedText, { color: theme.mutedText }]}>
              Domicilia, versión académica del Taller de Integración IV.
            </ThemedText>
          )}
        </Section>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          accessibilityState={{ busy: cerrando, disabled: cerrando }}
          disabled={cerrando}
          onPress={cerrarSesion}
          style={({ pressed }) => [
            styles.logout,
            { backgroundColor: theme.surface, borderColor: theme.dangerBorder },
            pressed && styles.pressed,
          ]}>
          {cerrando ? (
            <ActivityIndicator size="small" color={theme.danger} />
          ) : (
            <MaterialCommunityIcons name="logout" size={20} color={theme.danger} />
          )}
          <ThemedText style={[styles.buttonText, { color: theme.danger }]}>
            {cerrando ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 20, paddingBottom: 36, paddingHorizontal: 16, paddingTop: 18 },
  flex: { flex: 1 },
  // Cabecera
  hero: { backgroundColor: BrandColors.primary, borderRadius: 22, overflow: 'hidden', padding: 20, position: 'relative' },
  heroDecorationTop: {
    backgroundColor: BrandColors.heroHighlight, borderRadius: 80, height: 150, opacity: 0.5,
    position: 'absolute', right: -55, top: -65, width: 150,
  },
  heroDecorationBottom: {
    backgroundColor: BrandColors.heroAccent, borderRadius: 65, bottom: -70, height: 130, left: -45,
    opacity: 0.3, position: 'absolute', width: 130,
  },
  heroTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heroCopy: { flex: 1, paddingRight: 12 },
  eyebrow: { fontSize: 13, fontWeight: '700', letterSpacing: 0.7, lineHeight: 18 },
  heroTitle: { fontSize: 27, fontWeight: '800', lineHeight: 33, marginTop: 4 },
  avatar: {
    alignItems: 'center', backgroundColor: BrandColors.overlay, borderColor: BrandColors.overlayBorder,
    borderRadius: 30, borderWidth: StyleSheet.hairlineWidth, height: 60, justifyContent: 'center', width: 60,
  },
  avatarText: { fontSize: 20, fontWeight: '800', lineHeight: 26 },
  userRow: {
    alignItems: 'center', backgroundColor: BrandColors.overlaySubtle, borderColor: BrandColors.overlay,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, marginTop: 18,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  userName: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  userEmail: { fontSize: 13, lineHeight: 18 },
  rolePill: { backgroundColor: BrandColors.overlayStrong, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  roleText: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  // Secciones y filas
  section: { gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  group: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
    shadowColor: BrandColors.shadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 2,
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 72, paddingHorizontal: 14, paddingVertical: 12 },
  iconBox: { alignItems: 'center', borderRadius: 12, height: 44, justifyContent: 'center', width: 44 },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  rowDescription: { fontSize: 14, lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 70 },
  expanded: { borderTopWidth: StyleSheet.hairlineWidth, gap: 16, padding: 14 },
  expandedText: { fontSize: 15, lineHeight: 22, paddingBottom: 14, paddingHorizontal: 14, paddingLeft: 70 },
  form: { gap: 12 },
  formTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  feedback: { alignItems: 'center', borderRadius: 10, flexDirection: 'row', gap: 8, padding: 10 },
  feedbackText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  // Botones
  primary: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 50, paddingHorizontal: 16 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  logout: {
    alignItems: 'center', borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', gap: 8,
    justifyContent: 'center', minHeight: 54,
  },
  pressed: { opacity: 0.78 },
});
