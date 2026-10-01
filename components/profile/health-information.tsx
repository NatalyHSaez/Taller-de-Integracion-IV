import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View, } from 'react-native';

type Medication = {
  id: string;
  name: string;
  dose: string;
  frequencyHours: number;
};

export function HealthInformation() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [editing, setEditing] = useState(false);

  const [hasHypertension, setHasHypertension] = useState(true);
  const [hasDiabetes, setHasDiabetes] = useState(true);

  const [medications, setMedications] = useState<Medication[]>([
    {
      id: '1',
      name: 'Losartán',
      dose: '50 mg',
      frequencyHours: 12,
    },
  ]);

  const [medicationName, setMedicationName] = useState('');
  const [medicationDose, setMedicationDose] = useState('');
  const [medicationFrequency, setMedicationFrequency] = useState('');
  const [editingMedicationId, setEditingMedicationId] =
    useState<string | null>(null);

  const clearMedicationForm = () => {
    setMedicationName('');
    setMedicationDose('');
    setMedicationFrequency('');
    setEditingMedicationId(null);
  };

  const saveMedication = () => {
    const name = medicationName.trim();
    const dose = medicationDose.trim();
    const frequency = Number(medicationFrequency);

    if (!name || !dose || !medicationFrequency.trim()) {
      Alert.alert(
        'Datos incompletos',
        'Completa todos los campos del medicamento.'
      );
      return;
    }

    if (!Number.isFinite(frequency) || frequency <= 0) {
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
                name,
                dose,
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
          name,
          dose,
          frequencyHours: frequency,
        },
      ]);
    }

    clearMedicationForm();
  };

  const editMedication = (medication: Medication) => {
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
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setMedications((current) =>
              current.filter(
                (medication) => medication.id !== id
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

  return (
    <View style={styles.container}>
      {/* Enfermedades */}
      <View style={styles.titleRow}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: theme.primarySoft },
          ]}
        >
          <MaterialCommunityIcons
            name="heart-pulse"
            size={21}
            color={theme.primary}
          />
        </View>

        <ThemedText style={styles.title}>
          Enfermedades
        </ThemedText>
      </View>

      <ThemedText
        style={[
          styles.helper,
          { color: theme.mutedText },
        ]}
      >
        {editing
          ? 'Selecciona las condiciones que correspondan.'
          : 'Condiciones registradas del paciente.'}
      </ThemedText>

      <View style={styles.conditions}>
        <ConditionOption
          label="Hipertensión"
          selected={hasHypertension}
          editable={editing}
          onPress={() =>
            setHasHypertension((value) => !value)
          }
          primary={theme.primary}
          soft={theme.primarySoft}
          border={theme.border}
        />

        <ConditionOption
          label="Diabetes tipo 2"
          selected={hasDiabetes}
          editable={editing}
          onPress={() =>
            setHasDiabetes((value) => !value)
          }
          primary={theme.primary}
          soft={theme.primarySoft}
          border={theme.border}
        />
      </View>

      <View
        style={[
          styles.divider,
          { backgroundColor: theme.border },
        ]}
      />

      {/* Medicamentos */}
      <View style={styles.titleRow}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: theme.primarySoft },
          ]}
        >
          <MaterialCommunityIcons
            name="pill"
            size={21}
            color={theme.primary}
          />
        </View>

        <ThemedText style={styles.title}>
          Medicamentos
        </ThemedText>
      </View>

      {medications.length === 0 ? (
        <ThemedText
          style={[
            styles.empty,
            { color: theme.mutedText },
          ]}
        >
          No hay medicamentos registrados.
        </ThemedText>
      ) : (
        medications.map((medication) => (
          <View
            key={medication.id}
            style={[
              styles.medicationCard,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.medicationHeader}>
              <View style={styles.medicationIdentity}>
                <View
                  style={[
                    styles.medicationIcon,
                    { backgroundColor: theme.primarySoft },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="pill"
                    size={19}
                    color={theme.primary}
                  />
                </View>

                <ThemedText style={styles.medicationName}>
                  {medication.name}
                </ThemedText>
              </View>

              {editing && (
                <View style={styles.actions}>
                  <Pressable
                    accessibilityLabel="Editar medicamento"
                    onPress={() => editMedication(medication)}
                    style={({ pressed }) => [
                      styles.iconButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={20}
                      color={theme.primary}
                    />
                  </Pressable>

                  <Pressable
                    accessibilityLabel="Eliminar medicamento"
                    onPress={() =>
                      removeMedication(medication.id)
                    }
                    style={({ pressed }) => [
                      styles.iconButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="delete-outline"
                      size={20}
                      color={theme.danger}
                    />
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.medicationDetails}>
              <View style={styles.detail}>
                <ThemedText
                  style={[
                    styles.detailLabel,
                    { color: theme.mutedText },
                  ]}
                >
                  Cantidad
                </ThemedText>

                <ThemedText style={styles.detailValue}>
                  {medication.dose}
                </ThemedText>
              </View>

              <View style={styles.detail}>
                <ThemedText
                  style={[
                    styles.detailLabel,
                    { color: theme.mutedText },
                  ]}
                >
                  Frecuencia
                </ThemedText>

                <ThemedText style={styles.detailValue}>
                  Cada {medication.frequencyHours} horas
                </ThemedText>
              </View>
            </View>
          </View>
        ))
      )}

      {editing && (
        <>
          <View
            style={[
              styles.divider,
              { backgroundColor: theme.border },
            ]}
          />

          <ThemedText style={styles.formTitle}>
            {editingMedicationId
              ? 'Editar medicamento'
              : 'Agregar medicamento'}
          </ThemedText>

          <FormField label="Nombre del medicamento">
            <TextInput
              value={medicationName}
              onChangeText={setMedicationName}
              placeholder="Ej. Losartán"
              placeholderTextColor={theme.mutedText}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
              ]}
            />
          </FormField>

          <FormField label="Cantidad / dosis">
            <TextInput
              value={medicationDose}
              onChangeText={setMedicationDose}
              placeholder="Ej. 50 mg"
              placeholderTextColor={theme.mutedText}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
              ]}
            />
          </FormField>

          <FormField label="¿Cada cuántas horas?">
            <View style={styles.frequencyRow}>
              <TextInput
                value={medicationFrequency}
                onChangeText={setMedicationFrequency}
                keyboardType="number-pad"
                placeholder="12"
                placeholderTextColor={theme.mutedText}
                style={[
                  styles.input,
                  styles.frequencyInput,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.background,
                  },
                ]}
              />

              <ThemedText
                style={[
                  styles.hours,
                  { color: theme.mutedText },
                ]}
              >
                horas
              </ThemedText>
            </View>
          </FormField>

          <Pressable
            onPress={saveMedication}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons
              name={
                editingMedicationId
                  ? 'content-save-outline'
                  : 'plus'
              }
              size={20}
              color="#FFFFFF"
            />

            <ThemedText style={styles.primaryButtonText}>
              {editingMedicationId
                ? 'Guardar medicamento'
                : 'Agregar medicamento'}
            </ThemedText>
          </Pressable>

          {editingMedicationId && (
            <Pressable
              onPress={clearMedicationForm}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.primary },
                pressed && styles.pressed,
              ]}
            >
              <ThemedText
                style={[
                  styles.secondaryButtonText,
                  { color: theme.primary },
                ]}
              >
                Cancelar edición
              </ThemedText>
            </Pressable>
          )}
        </>
      )}

      {editing ? (
        <Pressable
          onPress={() => {
            clearMedicationForm();
            setEditing(false);
          }}
          style={({ pressed }) => [
            styles.finishButton,
            pressed && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            name="check-circle-outline"
            size={20}
            color={theme.primary}
          />

          <ThemedText
            style={[
              styles.finishText,
              { color: theme.primary },
            ]}
          >
            Terminar edición
          </ThemedText>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setEditing(true)}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: theme.primary },
            pressed && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            name="pencil-outline"
            size={18}
            color={theme.primary}
          />

          <ThemedText
            style={[
              styles.secondaryButtonText,
              { color: theme.primary },
            ]}
          >
            Editar información de salud
          </ThemedText>
        </Pressable>
      )}
    </View>
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
      disabled={!editable}
      accessibilityRole={editable ? 'checkbox' : undefined}
      accessibilityState={
        editable ? { checked: selected } : undefined
      }
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
        color={selected ? primary : border}
      />

      <ThemedText style={styles.conditionText}>
        {label}
      </ThemedText>
    </Pressable>
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

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },

  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },

  iconContainer: {
    alignItems: 'center',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },

  title: {
    fontSize: 16,
    fontWeight: '800',
  },

  helper: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -7,
  },

  conditions: {
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

  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },

  medicationCard: {
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 13,
    padding: 14,
  },

  medicationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  medicationIdentity: {
    alignItems: 'center',
    flex: 1,
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

  medicationName: {
    fontSize: 16,
    fontWeight: '800',
  },

  actions: {
    alignItems: 'center',
    flexDirection: 'row',
  },

  iconButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },

  medicationDetails: {
    flexDirection: 'row',
    gap: 30,
  },

  detail: {
    flex: 1,
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

  empty: {
    fontSize: 14,
  },

  formTitle: {
    fontSize: 16,
    fontWeight: '800',
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

  frequencyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },

  frequencyInput: {
    flex: 1,
  },

  hours: {
    fontSize: 14,
    fontWeight: '700',
  },

  primaryButton: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
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

  finishButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingVertical: 8,
  },

  finishText: {
    fontSize: 14,
    fontWeight: '700',
  },

  pressed: {
    opacity: 0.65,
  },
});