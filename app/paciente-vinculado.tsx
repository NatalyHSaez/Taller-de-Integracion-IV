import { HealthInformation } from '@/components/profile/health-information';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDemo } from '@/hooks/use-demo';

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { useAppState } from '@/hooks/use-app-state';
import { useAuth } from '@/hooks/use-auth';
import {
  createPatientProfile,
  formatAge,
  formatBiologicalSex,
  formatBirthDate,
  formatManagementMode,
  resolveProfilePatientId,
} from '@/services/patient-profile';

export default function LinkedPatientScreen() {
  const router = useRouter();

  const { selectedPatient, sessionMode } = useAppState();
  const { patient: demoPatient } = useDemo();

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
  const [profileStore] = useState(() => createPatientProfile());
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
  const patientError = Boolean(profileError);

  const patient = isRealSession
    ? realPatient
      ? {
          name: realPatient.fullName,
          id: realPatient.id,
        }
      : null
    : demoPatient;

  const colorScheme = useColorScheme();

  const theme =
    Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  // Demo: fecha editable solo en el teléfono. Backend: la del paciente
  // (si es nula queda vacía y se muestra "Sin información").
  const [demoBirthDate, setBirthDate] = useState('');
  const birthDate = isRealSession
    ? formatBirthDate(realPatient?.birthDate) ?? ''
    : demoBirthDate;

  const [draftBirthDate, setDraftBirthDate] =
    useState(birthDate);

  const [editing, setEditing] = useState(false);

  /*
   * Si por algún motivo se entra a esta pantalla
   * sin haber seleccionado un paciente, volvemos atrás.
   */
  
  useEffect(() => {
    if (isRealSession) {
      if (patientId || loadingPatient || patientError) {
        return;
      }
    } else if (demoPatient) {
      return;
    }

    Alert.alert(
      'Paciente no disponible',
      'No hay un paciente seleccionado.',
      [
        {
          text: 'Volver',
          onPress: () => router.back(),
        },
      ]
    );
  }, [
    isRealSession,
    patientId,
    loadingPatient,
    patientError,
    demoPatient,
    router,
  ]);


  const patientInitials =
    patient?.name
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() ?? 'P';

  const startEditing = () => {
    setDraftBirthDate(birthDate);
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraftBirthDate(birthDate);
    setEditing(false);
  };

  const saveInformation = () => {
    const cleanBirthDate = draftBirthDate.trim();

    if (!cleanBirthDate) {
      Alert.alert(
        'Fecha requerida',
        'Ingresa la fecha de nacimiento.'
      );

      return;
    }

    setBirthDate(cleanBirthDate);
    setEditing(false);

    Alert.alert(
      'Información actualizada',
      'Los datos del paciente se actualizaron correctamente.'
    );
  };

  
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
          {!editing ? (
            <>
              {/* Nombre */}
              <InfoRow
                icon="account-outline"
                label="Nombre"
                value={patient.name}
                color={theme.primary}
              />

              <Divider color={theme.border} />

              {/* Fecha nacimiento */}
              <InfoRow
                icon="calendar-outline"
                label="Fecha de nacimiento"
                value={birthDate}
                color={theme.primary}
              />

              {isRealSession && (
                <>
                  <Divider color={theme.border} />
                  <InfoRow
                    icon="cake-variant-outline"
                    label="Edad"
                    value={formatAge(realPatient?.age) ?? ''}
                    color={theme.primary}
                  />

                  <Divider color={theme.border} />
                  <InfoRow
                    icon="human-male-female"
                    label="Sexo biológico"
                    value={formatBiologicalSex(realPatient?.biologicalSex) ?? ''}
                    color={theme.primary}
                  />

                  <Divider color={theme.border} />
                  <InfoRow
                    icon="account-cog-outline"
                    label="Modo de gestión"
                    value={formatManagementMode(realPatient?.managementMode) ?? ''}
                    color={theme.primary}
                  />
                </>
              )}

              {!isRealSession && (
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

                <ThemedText
                  style={styles.primaryButtonText}
                >
                  Editar información
                </ThemedText>
              </Pressable>
              )}
            </>
          ) : (
            <>
              <View style={styles.formField}>
                <ThemedText style={styles.formLabel}>
                  Fecha de nacimiento
                </ThemedText>

                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: theme.border,
                      backgroundColor:
                        theme.background,
                      color: theme.text,
                    },
                  ]}
                  value={draftBirthDate}
                  onChangeText={setDraftBirthDate}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={
                    theme.mutedText
                  }
                  keyboardType="numeric"
                />
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={saveInformation}
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

                <ThemedText
                  style={styles.primaryButtonText}
                >
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
          {isRealSession ? (
            <ThemedText style={{ color: theme.mutedText }}>
              La información de enfermedades y medicamentos
              todavía no está disponible desde el backend.
            </ThemedText>
          ) : (
            <HealthInformation />
          )}
        </View>

        {/* Nota temporal: solo en modo demostración */}
        {!isRealSession && (
        <View
          style={[
            styles.notice,
            {
              backgroundColor: theme.primarySoft,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="information-outline"
            size={20}
            color={theme.primary}
          />

          <ThemedText
            style={[
              styles.noticeText,
              {
                color: theme.primary,
              },
            ]}
          >
            Los datos médicos se encuentran en modo de
            demostración hasta realizar la conexión con el
            backend.
          </ThemedText>
        </View>
        )}
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