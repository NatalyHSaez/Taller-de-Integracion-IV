import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BrandColors, Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDemo } from '@/hooks/use-demo';
import { demo } from '@/services/demo-store';

type FeatherName = ComponentProps<typeof Feather>['name'];

type MenuOption = {
  title: string;
  description: string;
  icon: FeatherName;
  route?: '/atencion' | '/vinculos' | '/documentos' | '/perfil' | '/configuracion';
};

const MAIN_OPTIONS: MenuOption[] = [
  {
    title: 'Atención médica',
    description: 'Consulta tus canales de atención',
    icon: 'heart',
    route: '/atencion',
  },
  {
    title: 'Vínculos',
    description: 'Administra cuidadores y profesionales',
    icon: 'link-2',
    route: '/vinculos',
  },
  {
    title: 'Documentos',
    description: 'Revisa recetas, órdenes y archivos',
    icon: 'file-text',
    route: '/documentos',
  },
];

const ACCOUNT_OPTIONS: MenuOption[] = [
  { title: 'Mi perfil', description: 'Datos personales y red de cuidado', icon: 'user', route: '/perfil' },
  { title: 'Configuración', description: 'Preferencias y privacidad', icon: 'settings', route: '/configuracion' },];

export default function MenuScreen() {
  const { user: demoUser } = useDemo();
  const { user: authUser, signOut } = useAuth();

  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  /*
   * Nombre que mostraremos en la tarjeta.
   *
   * Sesión real:
   *   nombre_completo viene desde /auth/me
   *
   * Sesión demo:
   *   name viene desde demo-store
   */
  const displayName =
    authUser?.nombre_completo ||
    authUser?.nombre ||
    demoUser?.name ||
    'Usuario';

  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  const openOption = (option: MenuOption) => {
    if (option.route) {
      router.push(option.route);
      return;
    }

    Alert.alert(
      'Configuración',
      'Esta sección estará disponible próximamente.'
    );
  };

  const confirmLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Quieres cerrar tu sesión?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              /*
               * Limpiamos el recorrido demo, si existiera.
               */
              demo.logout();

              /*
               * Limpiamos la sesión REAL:
               *
               * - elimina tokens de SecureStore
               * - establece authUser = null
               */
              await signOut();

              /*
               * Volvemos al Login.
               */
              router.replace('/(auth)/login');
            } catch (error) {
              console.log('Error cerrando sesión:', error);

              Alert.alert(
                'Error',
                'No se pudo cerrar la sesión correctamente.'
              );
            }
          },
        },
      ]
    );
  };

  const renderOption = (
    option: MenuOption,
    index: number,
    options: MenuOption[]
  ) => (
    <Pressable
      accessibilityHint={`Abre ${option.title}`}
      accessibilityRole="button"
      key={option.title}
      onPress={() => openOption(option)}
      style={({ pressed }) => [
        styles.option,
        index < options.length - 1 && {
          borderBottomColor: theme.border,
          borderBottomWidth: 1,
        },
        pressed && styles.optionPressed,
      ]}
    >
      <View
        style={[
          styles.optionIcon,
          { backgroundColor: theme.primarySoft },
        ]}
      >
        <Feather
          color={theme.primary}
          name={option.icon}
          size={21}
        />
      </View>

      <View style={styles.optionCopy}>
        <Text
          style={[
            styles.optionTitle,
            { color: theme.text },
          ]}
        >
          {option.title}
        </Text>

        <Text
          style={[
            styles.optionDescription,
            { color: theme.mutedText },
          ]}
        >
          {option.description}
        </Text>
      </View>

      <Feather
        color={theme.mutedText}
        name="chevron-right"
        size={20}
      />
    </Pressable>
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: BrandColors.primary,
            borderColor: BrandColors.primary,
          },
        ]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {initials}
          </Text>
        </View>

        <View style={styles.profileCopy}>
          <Text style={styles.greeting}>
            Tu espacio de salud
          </Text>

          <Text style={styles.patientName}>
            {displayName}
          </Text>

          <Text style={styles.status}>
            Cuenta activa
          </Text>
        </View>

        <View style={styles.shield}>
          <Feather
            color={BrandColors.onPrimary}
            name="shield"
            size={20}
          />
        </View>
      </View>

      <Text
        style={[
          styles.sectionLabel,
          { color: theme.mutedText },
        ]}
      >
        SALUD Y ATENCIÓN
      </Text>

      <View
        style={[
          styles.optionGroup,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        {MAIN_OPTIONS.map((option, index) =>
          renderOption(option, index, MAIN_OPTIONS)
        )}
      </View>

      <Text
        style={[
          styles.sectionLabel,
          { color: theme.mutedText },
        ]}
      >
        CUENTA
      </Text>

      <View
        style={[
          styles.optionGroup,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        {ACCOUNT_OPTIONS.map((option, index) =>
          renderOption(option, index, ACCOUNT_OPTIONS)
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={confirmLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          {
            backgroundColor: theme.dangerBackground,
            borderColor: theme.dangerBorder,
          },
          pressed && styles.optionPressed,
        ]}
      >
        <Feather
          color={theme.danger}
          name="log-out"
          size={19}
        />

        <Text
          style={[
            styles.logoutText,
            { color: theme.danger },
          ]}
        >
          Cerrar sesión
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 36,
  },

  profileCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 28,
    padding: 18,
    shadowColor: BrandColors.shadow,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 3,
  },

  avatar: {
    alignItems: 'center',
    backgroundColor: BrandColors.overlay,
    borderColor: BrandColors.overlayBorder,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },

  avatarText: {
    color: BrandColors.onPrimary,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  profileCopy: {
    flex: 1,
    marginLeft: 14,
  },

  greeting: {
    color: BrandColors.onPrimaryEyebrow,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },

  patientName: {
    color: BrandColors.onPrimary,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 23,
  },

  status: {
    color: BrandColors.onPrimaryMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  shield: {
    alignItems: 'center',
    backgroundColor: BrandColors.overlay,
    borderColor: BrandColors.overlayBorder,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 9,
    marginLeft: 4,
  },

  optionGroup: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: BrandColors.shadow,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.07,
    shadowRadius: 9,
    elevation: 2,
  },

  option: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 78,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },

  optionPressed: {
    opacity: 0.62,
  },

  optionIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    marginRight: 13,
    width: 46,
  },

  optionCopy: {
    flex: 1,
    paddingRight: 10,
  },

  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },

  optionDescription: {
    fontSize: 12,
    lineHeight: 17,
  },

  logoutButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 52,
  },
<<<<<<< HEAD
  logoutText: { fontSize: 14, fontWeight: '700' },
=======

  logoutText: {
    fontSize: 14,
    fontWeight: '700',
  },
>>>>>>> Martin
});