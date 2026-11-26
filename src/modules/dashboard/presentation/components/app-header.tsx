import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState } from '@/src/core/presentation/session/use-app-state';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';
import { Colors } from '@/src/shared/presentation/theme';

/**
 * Encabezado superior de la app: fecha, titulo, subtitulo, campana de
 * notificaciones y avatar. Las pestanas lo usan sin titulo (lo calcula segun la
 * ruta); las secciones del menu le pasan su titulo y `back` para mostrar la
 * flecha que vuelve a la pantalla anterior.
 */
export function AppHeader({ title, subtitle, back = false }: { title?: string; subtitle?: string; back?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, selectedPatient, sessionMode } = useAppState();

  const patientName = selectedPatient?.name;

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const date = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long' }).format(new Date());
  const isCaregiver = user?.role === 'caregiver';

  let heading = `Hola, ${user?.name.split(' ')[0] ?? ''}`;
  let description =
    isCaregiver && patientName
      ? `Acompanas a ${patientName}`
      : isCaregiver
        ? 'Sin paciente seleccionado'
        : 'Resumen de salud';
  if (pathname === '/seguimiento') {
    heading = 'Seguimiento';
    description = isCaregiver && patientName ? `Mediciones de ${patientName}` : 'Tus mediciones';
  } else if (pathname === '/alertas') {
    heading = 'Alertas';
    description = isCaregiver && patientName ? `Avisos de ${patientName}` : 'Avisos importantes';
  } else if (pathname === '/menu') {
    heading = 'Menu';
    description = 'Opciones de tu cuenta';
  }
  if (title) heading = title;
  if (subtitle) description = subtitle;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/menu');
  };

  return (
    <View style={[styles.header, { backgroundColor: theme.background, paddingTop: insets.top + 12 }]}>
      {back && (
        <Pressable
          accessibilityLabel="Volver"
          accessibilityRole="button"
          hitSlop={8}
          onPress={goBack}
          style={({ pressed }) => [styles.backButton, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.primary} />
        </Pressable>
      )}
      <View style={styles.copy}>
        <Text style={[styles.date, { color: theme.primary }]}>{date}</Text>
        <Text
          style={[styles.heading, back && styles.headingCompact, { color: theme.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}>
          {heading}
        </Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]} numberOfLines={1}>{description}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Abrir notificaciones"
          accessibilityRole="button"
          onPress={() => { if (pathname !== '/notificaciones') router.push('/notificaciones'); }}
          style={styles.notificationButton}>
          <MaterialCommunityIcons name="bell-outline" size={23} color={theme.primary} />
        </Pressable>
        <Pressable
          accessibilityLabel="Abrir perfil"
          accessibilityRole="button"
          onPress={() => { if (pathname !== '/perfil') router.push('/perfil'); }}
          style={[styles.avatar, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
          <Text style={[styles.avatarText, { color: theme.primary }]}>{user?.name.slice(0, 2).toUpperCase()}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', paddingBottom: 16, paddingHorizontal: 20 },
  pressed: { opacity: 0.6 },
  backButton: { alignItems: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, height: 44, justifyContent: 'center', width: 44 },
  copy: { flex: 1 },
  date: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4, textTransform: 'uppercase' },
  heading: { fontSize: 29, fontWeight: '800', letterSpacing: -0.6, lineHeight: 36 },
  headingCompact: { fontSize: 23, letterSpacing: -0.4, lineHeight: 30 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  notificationButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 40 },
  notificationDot: { borderRadius: 5, height: 8, position: 'absolute', right: 5, top: 7, width: 8 },
  avatar: { alignItems: 'center', borderRadius: 23, borderWidth: StyleSheet.hairlineWidth, height: 46, justifyContent: 'center', width: 46 },
  avatarText: { fontSize: 14, fontWeight: '800' },
});
