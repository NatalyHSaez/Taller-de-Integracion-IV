import { getPatient } from '@/src/modules/identity/application/identity-port';
import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';
import { Colors } from '@/src/shared/presentation/theme';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { useAppState } from '@/src/core/presentation/session/use-app-state';
import { useAuth } from '@/src/modules/identity/presentation/hooks/use-auth';
import { authSession } from '@/src/core/application/session/auth-session';
import {
  createPatientProfile,
  formatAge,
  formatBiologicalSex,
  formatBirthDate,
  formatManagementMode,
  resolveProfilePatientId,
} from '@/src/modules/identity/application/patient-profile';

function LinkedPatientContent() {
  const router = useRouter();

  const { selectedPatient, sessionMode } = useAppState();

  const { user: authUser } = useAuth();

  const isRealSession = sessionMode === 'backend';
  const isOwnProfile = isRealSession && Boolean(authUser?.roles.includes('PATIENT'));

  // Propio paciente: su id. Cuidador: el paciente seleccionado.
  const patientId = resolveProfilePatientId({
    isBackend: isRealSession,
    roles: authUser?.roles,
    userId: authUser?.id,
    selectedPatientId: selectedPatient?.id,
  });

  // GET /patients/{patientId}. Cambiar de paciente descarta la ficha anterior.
  const [profileStore] = useState(() => createPatientProfile(getPatient));
  const profileState = useSyncExternalStore(
    profileStore.subscribe,
    profileStore.getState,
    profileStore.getState,
  );

  useEffect(() => {
    void profileStore.setPatient(patientId);
  }, [profileStore, patientId]);

  // Solo se usa la ficha si corresponde al paciente activo.
  const realPatient =
    isRealSession && profileState.patientId === patientId ? profileState.profile : null;
  const loadingPatient = isRealSession && Boolean(patientId) && (profileState.loading || profileState.patientId !== patientId);
  const profileError =
    isRealSession && profileState.patientId === patientId ? profileState.error : null;

  const patient = realPatient ? { name: realPatient.fullName, id: realPatient.id } : null;

  const colorScheme = useColorScheme();

  const theme =
    Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  // Fecha de nacimiento informada por el servidor. Sin edición local.
  const birthDate = formatBirthDate(realPatient?.birthDate) ?? '';

  // LinkedPatientContent tiene una key por sesión y paciente; al cambiar
  // identidad se desmonta y los borradores locales se reinician de forma segura.

  const patientInitials =
    patient?.name
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() ?? 'P';

  if (isRealSession && patientId && loadingPatient && !realPatient) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>
          Cargando información del paciente...
        </ThemedText>
      </ThemedView>
    );
  }

  if (isRealSession && profileError) {
    return (
      <ThemedView style={styles.center}>
        <Stack.Screen options={{ title: 'Ficha del paciente', headerShown: true, headerBackTitle: 'Volver' }} />
        <MaterialCommunityIcons
          name={
            profileError.kind === 'forbidden'
              ? 'lock-outline'
              : profileError.kind === 'not_found'
                ? 'account-question-outline'
                : profileError.kind === 'session'
                  ? 'account-lock-outline'
                  : 'cloud-alert-outline'
          }
          size={48}
          color={theme.mutedText}
        />

        <ThemedText accessibilityRole="header" style={styles.notFoundTitle}>
          {profileError.title}
        </ThemedText>

        <ThemedText
          style={[
            styles.notFoundText,
            { color: theme.mutedText },
          ]}
        >
          {profileError.message}
        </ThemedText>

        {profileError.retryable ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void profileStore.retry()}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
            <ThemedText style={styles.backButtonText}>
              Reintentar
            </ThemedText>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            profileError.retryable ? styles.secondaryButton : styles.backButton,
            profileError.retryable
              ? { borderColor: theme.primary }
              : { backgroundColor: theme.primary },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText
            style={
              profileError.retryable
                ? [styles.secondaryButtonText, { color: theme.primary }]
                : styles.backButtonText
            }
          >
            Volver
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (!patient) {
    return (
      <ThemedView style={styles.center}>
        <MaterialCommunityIcons
          name="account-alert-outline"
          size={48}
          color={theme.mutedText}
        />

        <ThemedText style={styles.notFoundTitle}>
          Paciente no disponible
        </ThemedText>

        <ThemedText
          style={[
            styles.notFoundText,
            { color: theme.mutedText },
          ]}
        >
          Selecciona un paciente desde tu perfil.
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: theme.primary,
            },
            pressed && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={20}
            color="#FFFFFF"
          />

          <ThemedText style={styles.backButtonText}>
            Volver
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
  <ThemedView style={styles.screen}>
    <Stack.Screen
      options={{
        title: 'Ficha del paciente',
        headerShown: true,
        headerBackTitle: 'Volver',
      }}
    />

    <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera del paciente */}
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
              {patientInitials}
            </ThemedText>
          </View>

          <View style={styles.profileIdentity}>
            <ThemedText style={styles.profileName}>
              {patient.name}
            </ThemedText>

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
                {isOwnProfile ? 'Mi ficha' : 'Paciente vinculado'}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Información personal */}
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
            Datos personales del paciente
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
          <InfoRow icon="account-outline" label="Nombre"
            value={patient.name} color={theme.primary} />
          <Divider color={theme.border} />
          <InfoRow icon="calendar-outline" label="Fecha de nacimiento"
            value={birthDate || 'Sin información'} color={theme.primary} />
          <Divider color={theme.border} />
          <InfoRow icon="cake-variant-outline" label="Edad"
            value={formatAge(realPatient?.age) ?? 'Sin información'} color={theme.primary} />
          <Divider color={theme.border} />
          <InfoRow icon="human-male-female" label="Sexo biológico"
            value={formatBiologicalSex(realPatient?.biologicalSex) ?? 'Sin información'} color={theme.primary} />
          <Divider color={theme.border} />
          <InfoRow icon="account-cog-outline" label="Modo de gestión"
            value={formatManagementMode(realPatient?.managementMode) ?? 'Sin información'} color={theme.primary} />
        </View>

        {/* Información de salud */}
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
          <ThemedText style={{ color: theme.mutedText }}>
            La información de enfermedades y medicamentos todavía no está disponible desde el backend.
          </ThemedText>
        </View>

      </ScrollView>
    </ThemedView>
  );
}

/** Aislamiento estricto entre fichas de cuentas o pacientes distintos. */
export default function LinkedPatientScreen() {
  const { user, sessionMode, selectedPatient } = useAppState();
  const generation = authSession.generation();
  const identity = `${generation}:${sessionMode ?? 'none'}:${user?.id ?? 'none'}:${selectedPatient?.id ?? 'none'}`;
  return <LinkedPatientContent key={identity} />;
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
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={color}
      />

      <View style={styles.infoCopy}>
        <ThemedText style={styles.infoLabel}>
          {label}
        </ThemedText>

        <ThemedText style={styles.infoValue}>
          {value || 'Sin información'}
        </ThemedText>
      </View>
    </View>
  );
}

function Divider({
  color,
}: {
  color: string;
}) {
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

  center: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    padding: 24,
  },

  profileCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 16,
    padding: 18,
  },

  avatar: {
    alignItems: 'center',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },

  avatarText: {
    fontSize: 21,
    fontWeight: '800',
  },

  profileIdentity: {
    flex: 1,
    gap: 7,
  },

  profileName: {
    fontSize: 21,
    fontWeight: '800',
  },

  roleBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  roleText: {
    fontSize: 13,
    fontWeight: '700',
  },

  sectionHeader: {
    gap: 3,
    marginTop: 6,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
  },

  infoCopy: {
    flex: 1,
    gap: 2,
  },

  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },

  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },

  formField: {
    gap: 7,
  },

  formLabel: {
    fontSize: 14,
    fontWeight: '700',
  },

  input: {
    borderRadius: 11,
    borderWidth: 1,
    fontSize: 15,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },

  primaryButton: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 3,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  secondaryButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },

  notice: {
    alignItems: 'flex-start',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },

  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },

  notFoundTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },

  notFoundText: {
    fontSize: 14,
    textAlign: 'center',
  },

  backButton: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  pressed: {
    opacity: 0.65,
  },
});
