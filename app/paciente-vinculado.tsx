import { HealthInformation } from '@/components/profile/health-information';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDemo } from '@/hooks/use-demo';

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

export default function LinkedPatientScreen() {
  const router = useRouter();

  const { patient } = useDemo();

  const colorScheme = useColorScheme();

  const theme =
    Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  /*
   * Por ahora la fecha de nacimiento es un dato temporal.
   * Cuando conectemos el backend, vendrá desde el paciente.
   */
  const [birthDate, setBirthDate] =
    useState('15/06/1985');

  const [draftBirthDate, setDraftBirthDate] =
    useState(birthDate);

  const [editing, setEditing] = useState(false);

  /*
   * Si por algún motivo se entra a esta pantalla
   * sin haber seleccionado un paciente, volvemos atrás.
   */
  useEffect(() => {
    if (!patient) {
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
    }
  }, [patient, router]);

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
                Paciente vinculado
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
          <HealthInformation />
        </View>

        {/* Nota temporal */}
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