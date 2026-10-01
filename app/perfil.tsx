import { HealthInformation } from '@/components/profile/health-information';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDemo } from '@/hooks/use-demo';
import { demo } from '@/services/demo-store';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View, } from 'react-native';

export default function Profile() {
  const { user: demoUser, patients } = useDemo();

  const {
    user: authUser,
    authenticated,
    signOut,
  } = useAuth();

  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  // ==========================================================
  // DATOS DEL USUARIO
  // ==========================================================

  // Si existe una sesión real, usamos primero los datos
  // entregados por el backend.
  const displayName =
    authUser?.nombre_completo ??
    authUser?.nombre ??
    demoUser?.name ??
    'Usuario';

  const displayEmail =
    authUser?.correo ??
    authUser?.email ??
    demoUser?.email ??
    '';

  const realRole =
    authUser?.roles?.[0] ??
    authUser?.rol;

  const displayRole =
    realRole === 'paciente' ||
    demoUser?.role === 'patient'
      ? 'Paciente'
      : realRole === 'cuidador' ||
          demoUser?.role === 'caregiver'
        ? 'Cuidador'
        : 'Usuario';

  // ==========================================================
  // INFORMACIÓN PERSONAL
  // ==========================================================

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Por ahora no inventamos una fecha.
  // Si el backend no entrega una, InfoRow mostrará
  // "Sin información".
  const [birthDate, setBirthDate] = useState('');

  // ==========================================================
  // DATOS TEMPORALES DE SALUD
  // ==========================================================

  const [hasHypertension, setHasHypertension] = useState(true);
  const [hasDiabetes, setHasDiabetes] = useState(false);

  const [medications, setMedications] = useState([
    {
      id: '1',
      name: 'Losartán',
      dose: '50 mg',
      frequencyHours: 12,
    },
  ]);

  const [editingHealth, setEditingHealth] = useState(false);

  const [medicationName, setMedicationName] = useState('');
  const [medicationDose, setMedicationDose] = useState('');
  const [medicationFrequency, setMedicationFrequency] = useState('');

  const [editingMedicationId, setEditingMedicationId] =
    useState<string | null>(null);

  // ==========================================================
  // EDITAR PERFIL
  // ==========================================================

  const startEditing = () => {
    // Para una cuenta real todavía no escribimos en demo-store.
    // Primero necesitamos conectar el endpoint de actualización
    // del backend.
    if (authenticated) {
      Alert.alert(
        'Edición de perfil',
        'Tus datos están conectados con tu cuenta real. La edición se habilitará cuando conectemos el endpoint de actualización del perfil.'
      );

      return;
    }

    setName(
      displayName === 'Usuario'
        ? ''
        : displayName
    );

    setEmail(displayEmail);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setName('');
    setEmail('');
  };

  const saveProfile = () => {
    // Protección para evitar guardar datos reales
    // accidentalmente en el demo-store.
    if (authenticated) {
      Alert.alert(
        'Edición de perfil',
        'No se realizaron cambios porque esta cuenta está conectada al backend.'
      );

      setEditing(false);
      return;
    }

    try {
      demo.updateProfile(
        name.trim(),
        email.trim()
      );

      setEditing(false);

      Alert.alert(
        'Perfil actualizado',
        'Tus datos se guardaron correctamente.'
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'No se pudieron guardar los cambios.'
      );
    }
  };

  // ==========================================================
  // MEDICAMENTOS
  // ==========================================================

  const clearMedicationForm = () => {
    setMedicationName('');
    setMedicationDose('');
    setMedicationFrequency('');
    setEditingMedicationId(null);
  };

  const saveMedication = () => {
    const cleanName = medicationName.trim();
    const cleanDose = medicationDose.trim();
    const frequency = Number(medicationFrequency);

    if (
      !cleanName ||
      !cleanDose ||
      !medicationFrequency.trim()
    ) {
      Alert.alert(
        'Datos incompletos',
        'Completa el nombre, la cantidad y la frecuencia.'
      );

      return;
    }

    if (
      !Number.isFinite(frequency) ||
      frequency <= 0
    ) {
      Alert.alert(
        'Frecuencia inválida',
        'Ingresa una cantidad de horas válida.'
      );

      return;
    }

    if (editingMedicationId) {
      setMedications((current) =>
        current.map((medication) =>
          medication.id === editingMedicationId
            ? {
                ...medication,
                name: cleanName,
                dose: cleanDose,
                frequencyHours: frequency,
              }
            : medication
        )
      );
    } else {
      setMedications((current) => [
        ...current,
        {
          id: Date.now().toString(),
          name: cleanName,
          dose: cleanDose,
          frequencyHours: frequency,
        },
      ]);
    }

    clearMedicationForm();
  };

  const editMedication = (id: string) => {
    const medication = medications.find(
      (item) => item.id === id
    );

    if (!medication) {
      return;
    }

    setMedicationName(medication.name);
    setMedicationDose(medication.dose);
    setMedicationFrequency(
      medication.frequencyHours.toString()
    );

    setEditingMedicationId(medication.id);
  };

  const removeMedication = (id: string) => {
    Alert.alert(
      'Eliminar medicamento',
      '¿Deseas eliminar este medicamento?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',

          onPress: () => {
            setMedications((current) =>
              current.filter(
                (medication) =>
                  medication.id !== id
              )
            );

            if (editingMedicationId === id) {
              clearMedicationForm();
            }
          },
        },
      ]
    );
  };

  // ==========================================================
  // CERRAR SESIÓN
  // ==========================================================

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Deseas cerrar tu sesión?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Cerrar sesión',
          style: 'destructive',

          onPress: async () => {
            // Limpia cualquier sesión demo.
            demo.logout();

            // Limpia la sesión real y sus tokens.
            await signOut();

            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  // ==========================================================
  // AVATAR
  // ==========================================================

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || 'U';

  // ==========================================================
  // INTERFAZ
  // ==========================================================

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera del perfil */}
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
            <ThemedText style={styles.profileName}>
              {displayName}
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
                {displayRole}
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
                value={
                  displayName === 'Usuario'
                    ? ''
                    : displayName
                }
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

              <FormField label="Fecha de nacimiento">
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

        {/* Información de salud */}
        {displayRole === 'Paciente' && (
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

        {/* Pacientes vinculados del cuidador */}
        {displayRole === 'Cuidador' && (
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
              {patients.length > 0 ? (
                patients.map((patient) => (
                  <Pressable
                    key={patient.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver información de ${patient.name}`}
                    onPress={() => {
                      demo.select(patient.id);
                      router.push('/paciente-vinculado');
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

        {/* Cuenta */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>
            Cuenta
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
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/vinculos')}
            style={({ pressed }) => [
              styles.menuRow,
              pressed && styles.pressed,
            ]}
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
            style={({ pressed }) => [
              styles.menuRow,
              pressed && styles.pressed,
            ]}
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

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.formField}>
      <ThemedText style={styles.formLabel}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return (
    <View
      style={[
        styles.divider,
        { backgroundColor: color },
      ]}
    />
  );
}

function ConditionOption({
  label,
  selected,
  editable,
  onPress,
  primary,
  soft,
  border,
}: {
  label: string;
  selected: boolean;
  editable: boolean;
  onPress: () => void;
  primary: string;
  soft: string;
  border: string;
}) {
  return (
    <Pressable
      accessibilityRole={editable ? 'checkbox' : undefined}
      accessibilityState={
        editable ? { checked: selected } : undefined
      }
      disabled={!editable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.condition,
        {
          borderColor:
            editable && selected ? primary : border,
          backgroundColor:
            editable && selected ? soft : 'transparent',
        },
        pressed && editable && styles.pressed,
      ]}
    >
      <MaterialCommunityIcons
        name={
          editable
            ? selected
              ? 'checkbox-marked'
              : 'checkbox-blank-outline'
            : selected
              ? 'check-circle'
              : 'minus-circle-outline'
        }
        size={22}
        color={
          selected
            ? primary
            : border
        }
      />

      <ThemedText style={styles.conditionText}>
        {label}
      </ThemedText>
    </Pressable>
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

  healthTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },

  smallIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },

  helperText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -7,
  },

  conditionList: {
    gap: 9,
  },

  condition: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },

  conditionText: {
    fontSize: 14,
    fontWeight: '600',
  },

  medicationCard: {
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    padding: 14,
  },

  medicationTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  medicationName: {
    fontSize: 16,
    fontWeight: '800',
  },

  medicationDetails: {
    flexDirection: 'row',
    gap: 40,
  },

  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },

  emptyText: {
    fontSize: 14,
  },

  menuRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
  },

  menuLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },

  menuText: {
    fontSize: 15,
    fontWeight: '700',
  },

  pressed: {
    opacity: 0.65,
  },

  patientRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 58,
  },

  patientAvatar: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },

  patientInfo: {
    flex: 1,
    gap: 3,
    marginLeft: 13,
  },

  patientName: {
    fontSize: 16,
    fontWeight: '800',
  },

  patientDescription: {
    fontSize: 13,
  },

  medicationTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },

  medicationIcon: {
    alignItems: 'center',
    borderRadius: 9,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },

  medicationActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },

  iconButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },

  medicationDetail: {
    flex: 1,
  },

  medicationFormHeader: {
    gap: 3,
  },

  frequencyInput: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },

  frequencyTextInput: {
    flex: 1,
  },

  hoursText: {
    fontSize: 14,
    fontWeight: '700',
  },

  finishHealthButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingVertical: 8,
  },

  finishHealthText: {
    fontSize: 14,
    fontWeight: '700',
  },

  emptyPatients: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },

  emptyPatientsText: {
    fontSize: 14,
    textAlign: 'center',
  },
});