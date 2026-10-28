import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Speech from "expo-speech";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BrandColors, Colors, MeasurementColors } from "@/constants/theme";
import { useAppState } from "@/hooks/use-app-state";
import { useAuth } from "@/hooks/use-auth";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { confirmReading, createReading, type CreateReadingRequest } from "@/services/api";
import { demo } from "@/services/demo-store";
import type { MeasurementType } from "@/types/measurement";
import { useRouter } from "expo-router";

type GlucoseContext = "fasting" | "before_meal" | "after_meal";

type MeasurementOption = {
  value: MeasurementType;
  label: string;
  icon: "heart-pulse" | "water-outline" | "scale-bathroom";
};

const MEASUREMENT_OPTIONS: MeasurementOption[] = [
  {
    value: "blood_pressure",
    label: "Presión",
    icon: "heart-pulse",
  },
  {
    value: "glucose",
    label: "Glucosa",
    icon: "water-outline",
  },
  {
    value: "weight",
    label: "Peso",
    icon: "scale-bathroom",
  },
];

const GLUCOSE_CONTEXTS: { value: GlucoseContext; label: string }[] = [
  { value: "fasting", label: "En ayunas" },
  { value: "before_meal", label: "Antes de comer" },
  { value: "after_meal", label: "Después de comer" },
];

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

// Límites técnicos y unidades canónicas de services/seguimiento/catalogo.py.
// Los valores inusuales dentro de estos rangos se envían al servidor,
// que puede solicitar confirmación mediante REQUIRES_CONFIRMATION.
type ClinicalParameterCode = "SBP" | "DBP" | "HEART_RATE" | "GLUCOSE" | "WEIGHT";

const CLINICAL_LIMITS: Record<
  ClinicalParameterCode,
  { min: number; max: number; unit: string; label: string }
> = {
  SBP: { min: 40, max: 300, unit: "mmHg", label: "La presión sistólica" },
  DBP: { min: 30, max: 200, unit: "mmHg", label: "La presión diastólica" },
  HEART_RATE: { min: 20, max: 250, unit: "bpm", label: "La frecuencia cardíaca" },
  GLUCOSE: { min: 10, max: 1000, unit: "mg/dL", label: "La glucosa" },
  WEIGHT: { min: 2, max: 400, unit: "kg", label: "El peso" },
};

function validateClinicalValue(value: string, code: ClinicalParameterCode): string | null {
  const parameter = CLINICAL_LIMITS[code];
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return `Ingresa un valor para ${parameter.label.toLowerCase()}.`;
  // Evita conversiones inesperadas de Number(), como "0x10" o "1e3".
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    return `${parameter.label} debe ser un número válido.`;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < parameter.min || parsed > parameter.max) {
    return `${parameter.label} debe estar entre ${parameter.min} y ${parameter.max} ${parameter.unit}.`;
  }
  return null;
}

export default function RegisterMeasurementScreen() {
  const router = useRouter();
  const { selectedPatient: patient, user, sessionMode } = useAppState();
  const { user: authUser } = useAuth();
  const isBackend = sessionMode === "backend";
  const isRealPatient = isBackend && authUser?.roles.includes("paciente");
  const patientId = isRealPatient && authUser ? authUser.id : null;
  const [isSaving, setIsSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const savingRef = useRef(false);
  const [pendingReadingId, setPendingReadingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const themeName = isDark ? "dark" : "light";
  const theme = Colors[themeName];
  const insets = useSafeAreaInsets();
  const now = useMemo(() => new Date(), []);

  const [measurementType, setMeasurementType] =
    useState<MeasurementType>("blood_pressure");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [glucose, setGlucose] = useState("");
  const [glucoseContext, setGlucoseContext] = useState<GlucoseContext | null>(
    null,
  );
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(formatDate(now));
  const [time, setTime] = useState(formatTime(now));
  const [showReview, setShowReview] = useState(false);

  const accentColor = theme.primary;
  const surfaceColor = theme.surface;
  const borderColor = theme.border;
  const inputColor = theme.surfaceMuted;

  const validationError =
    measurementType === "blood_pressure"
      ? validateClinicalValue(systolic, "SBP") ??
        validateClinicalValue(diastolic, "DBP") ??
        validateClinicalValue(heartRate, "HEART_RATE")
      : measurementType === "glucose"
        ? validateClinicalValue(glucose, "GLUCOSE") ??
          (glucoseContext === null ? "Selecciona el contexto de la glucosa." : null)
        : validateClinicalValue(weight, "WEIGHT");

  const formIsValid =
    date.trim().length > 0 &&
    time.trim().length > 0 &&
    validationError === null;

  const selectedOption = MEASUREMENT_OPTIONS.find(
    (option) => option.value === measurementType,
  )!;
  const selectedColors = MeasurementColors[themeName][measurementType];

  function selectMeasurementType(value: MeasurementType) {
    setMeasurementType(value);
    setShowReview(false);
    setSaveError("");
  }

  function getSummaryValue() {
    if (measurementType === "blood_pressure") {
      return `${systolic} / ${diastolic} mmHg · ${heartRate} bpm`;
    }
    if (measurementType === "glucose") return `${glucose} mg/dL`;
    return `${weight.replace(".", ",")} kg`;
  }

  const contextLabel = GLUCOSE_CONTEXTS.find(
    (item) => item.value === glucoseContext,
  )?.label;
  async function save() {
    if (savingRef.current || completed) return;
    setSaveError("");

    // Una lectura ya creada no se debe enviar por segunda vez.
    if (pendingReadingId) {
      if (!patientId) {
        setSaveError("No se pudo identificar al paciente de esta lectura.");
        return;
      }
      savingRef.current = true;
      setIsSaving(true);
      try {
        const result = await confirmReading(patientId, pendingReadingId);
        if (result.status === "REQUIRES_CONFIRMATION") {
          setSaveError("La lectura todavía requiere confirmación. Intenta nuevamente.");
          return;
        }
        setPendingReadingId(null);
        setCompleted(true);
        Alert.alert("Lectura confirmada", "La medición quedó registrada en el servidor.", [
          { text: "Continuar", onPress: () => router.replace("/(tabs)") },
        ]);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "No se pudo confirmar la lectura.");
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
      return;
    }

    if (!showReview) {
      if (validationError) {
        setSaveError(validationError);
        return;
      }
      setShowReview(true);
      return;
    }

    if (validationError) {
      setSaveError(validationError);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      const [day, month, year] = date.split(/[/-]/).map(Number);
      const [hour, minute] = time.split(":").map(Number);
      const measured = new Date(year, month - 1, day, hour, minute);
      if (
        !/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(date) ||
        !/^\d{2}:\d{2}$/.test(time) ||
        measured.getFullYear() !== year ||
        measured.getMonth() !== month - 1 ||
        measured.getDate() !== day ||
        hour > 23 ||
        minute > 59 ||
        !Number.isFinite(measured.getTime()) ||
        measured.getTime() > Date.now()
      ) {
        throw new Error("Revisa la fecha (dd/mm/aaaa) y hora (hh:mm); no pueden ser futuras.");
      }

      const number = (value: string) => Number(value.replace(",", "."));

      if (isBackend) {
        if (!patientId) {
          throw new Error(
            "El registro de mediciones para cuidadores reales estará disponible cuando se integren los vínculos con pacientes."
          );
        }

        const request: CreateReadingRequest = {
          measuredAt: measured.toISOString(),
          source: "mobile",
          measurements:
            measurementType === "blood_pressure"
              ? [
                  { parameterCode: "SBP", value: number(systolic), unit: "mmHg" },
                  { parameterCode: "DBP", value: number(diastolic), unit: "mmHg" },
                  { parameterCode: "HEART_RATE", value: number(heartRate), unit: "bpm" },
                ]
              : measurementType === "glucose"
                ? [{ parameterCode: "GLUCOSE", value: number(glucose), unit: "mg/dL" }]
                : [{ parameterCode: "WEIGHT", value: number(weight), unit: "kg" }],
        };
        if (measurementType === "glucose") {
          request.context = glucoseContext === "after_meal" ? "POSTPRANDIAL" : "PREPRANDIAL";
        }

        const result = await createReading(patientId, request);
        if (result.status === "REQUIRES_CONFIRMATION") {
          setPendingReadingId(result.readingId);
          const reasons = result.confirmationReasons.length
            ? `\n\n${result.confirmationReasons.join("\n")}`
            : "";
          Alert.alert(
            "Confirmación necesaria",
            `El servidor guardó la lectura, pero necesita que confirmes sus valores.${reasons}\n\nRevisa los datos y pulsa «Confirmar lectura pendiente».`,
            [{ text: "Entendido" }],
          );
          return;
        }
        setCompleted(true);
        Alert.alert(
          "Medición registrada",
          result.status === "PENDING"
            ? "La lectura se guardó en el servidor y está pendiente de evaluación."
            : "La lectura se registró en el servidor.",
          [{ text: "Continuar", onPress: () => router.replace("/(tabs)") }],
        );
        return;
      }

      // Se conserva el funcionamiento original del modo demostración.
      const base = { id: "", measuredAt: measured.toISOString() };
      demo.save(
        measurementType === "blood_pressure"
          ? {
              ...base,
              type: "blood_pressure",
              systolic: number(systolic),
              diastolic: number(diastolic),
              heartRate: number(heartRate),
            }
          : measurementType === "glucose"
            ? {
                ...base,
                type: "glucose",
                value: number(glucose),
                unit: "mg/dL",
                context: contextLabel,
              }
            : { ...base, type: "weight", value: number(weight), unit: "kg" },
      );

      if (demo.snapshot().vozActiva) {
        const detalle =
          measurementType === "blood_pressure"
            ? `Presión arterial: ${systolic} sobre ${diastolic}, frecuencia cardíaca ${heartRate}`
            : measurementType === "glucose"
              ? `Glucosa: ${glucose} miligramos por decilitro`
              : `Peso: ${weight.replace(".", ",")} kilos`;
        const diaSemana = measured.toLocaleDateString("es-CL", { weekday: "long" });
        const fecha = measured.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
        const hora = measured.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
        Speech.speak(
          `Datos registrados correctamente. ${detalle}. ${diaSemana} ${fecha}, a las ${hora}.`,
          { language: "es-CL", volume: demo.snapshot().vozVolumen },
        );
      }
      router.replace(demo.permissions().read ? "/historial" : "/(tabs)");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No fue posible guardar la medición.");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.screen}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 24, 36) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ThemedText>
            Paciente: {isBackend ? (isRealPatient ? authUser?.nombre_completo : "Sin vínculo real") : patient?.name} · Registra: {isBackend ? authUser?.nombre_completo : user?.name}
          </ThemedText>
          {!!saveError && <ThemedText>{saveError}</ThemedText>}
          <View style={styles.hero}>
            <View style={styles.heroDecorationTop} />
            <View style={styles.heroDecorationBottom} />
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons
                name="heart-plus"
                size={31}
                color={BrandColors.onPrimary}
              />
            </View>
            <ThemedText
              lightColor={BrandColors.onPrimary}
              darkColor={BrandColors.onPrimary}
              style={styles.heroTitle}
            >
              Nueva medición
            </ThemedText>
            <ThemedText
              lightColor={BrandColors.onPrimaryMuted}
              darkColor={BrandColors.onPrimaryMuted}
              style={styles.heroDescription}
            >
              Ingresa los datos tal como aparecen en tu dispositivo de medición.
            </ThemedText>
          </View>

          <View style={styles.sectionHeading}>
            <View style={styles.stepBadge}>
              <ThemedText
                lightColor={BrandColors.onPrimary}
                darkColor={BrandColors.onPrimary}
                style={styles.stepBadgeText}
              >
                1
              </ThemedText>
            </View>
            <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
              Tipo de medición
            </ThemedText>
          </View>

          <View accessibilityRole="radiogroup" style={styles.typeRow}>
            {MEASUREMENT_OPTIONS.map((option) => {
              const isSelected = measurementType === option.value;
              const optionColors = MeasurementColors[themeName][option.value];
              return (
                <Pressable
                  key={option.value}
                  accessibilityLabel={option.label}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => { if (!pendingReadingId && !isSaving) selectMeasurementType(option.value); }}
                  style={({ pressed }) => [
                    styles.typeCard,
                    {
                      backgroundColor: surfaceColor,
                      borderColor: isSelected
                        ? optionColors.accent
                        : borderColor,
                    },
                    isSelected && styles.typeCardSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.typeIcon,
                      { backgroundColor: optionColors.background },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={option.icon}
                      size={25}
                      color={optionColors.accent}
                    />
                  </View>
                  <ThemedText style={styles.typeLabel}>
                    {option.label}
                  </ThemedText>
                  {isSelected && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={19}
                      color={optionColors.accent}
                      style={styles.checkIcon}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sectionHeading}>
            <View style={styles.stepBadge}>
              <ThemedText
                lightColor={BrandColors.onPrimary}
                darkColor={BrandColors.onPrimary}
                style={styles.stepBadgeText}
              >
                2
              </ThemedText>
            </View>
            <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
              Ingresa los valores
            </ThemedText>
          </View>

          <View
            style={[
              styles.formCard,
              { backgroundColor: surfaceColor, borderColor },
            ]}
          >
            {measurementType === "blood_pressure" && (
              <>
                <View style={styles.twoColumns}>
                  <MeasurementInput
                    label="Sistólica"
                    value={systolic}
                    onChangeText={(v) => { if (!pendingReadingId && !isSaving) { setSystolic(v); setShowReview(false); } }}
                    unit="mmHg"
                    placeholder="120"
                    inputColor={inputColor}
                    borderColor={borderColor}
                    textColor={theme.text}
                    placeholderColor={theme.placeholder}
                  />
                  <MeasurementInput
                    label="Diastólica"
                    value={diastolic}
                    onChangeText={(v) => { if (!pendingReadingId && !isSaving) { setDiastolic(v); setShowReview(false); } }}
                    unit="mmHg"
                    placeholder="80"
                    inputColor={inputColor}
                    borderColor={borderColor}
                    textColor={theme.text}
                    placeholderColor={theme.placeholder}
                  />
                </View>
                <MeasurementInput
                  label="Frecuencia cardíaca"
                  value={heartRate}
                  onChangeText={(v) => { if (!pendingReadingId && !isSaving) { setHeartRate(v); setShowReview(false); } }}
                  unit="bpm"
                  placeholder="72"
                  inputColor={inputColor}
                  borderColor={borderColor}
                  textColor={theme.text}
                  placeholderColor={theme.placeholder}
                />
              </>
            )}

            {measurementType === "glucose" && (
              <>
                <MeasurementInput
                  label="Glucosa"
                  value={glucose}
                  onChangeText={(v) => { if (!pendingReadingId && !isSaving) { setGlucose(v); setShowReview(false); } }}
                  unit="mg/dL"
                  placeholder="105"
                  inputColor={inputColor}
                  borderColor={borderColor}
                  textColor={theme.text}
                  placeholderColor={theme.placeholder}
                />
                <View style={styles.fieldGroup}>
                  <ThemedText style={styles.inputLabel}>
                    Contexto de la medición
                  </ThemedText>
                  <ThemedText style={[styles.fieldHelp, { color: theme.icon }]}>
                    Necesario para interpretar correctamente la glucosa.
                  </ThemedText>
                  <View
                    accessibilityRole="radiogroup"
                    style={styles.contextOptions}
                  >
                    {GLUCOSE_CONTEXTS.map((item) => {
                      const isSelected = glucoseContext === item.value;
                      return (
                        <Pressable
                          key={item.value}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: isSelected }}
                          onPress={() => { if (!pendingReadingId && !isSaving) { setGlucoseContext(item.value); setShowReview(false); } }}
                          style={({ pressed }) => [
                            styles.contextButton,
                            {
                              backgroundColor: isSelected
                                ? accentColor
                                : inputColor,
                              borderColor: isSelected
                                ? accentColor
                                : borderColor,
                            },
                            pressed && styles.pressed,
                          ]}
                        >
                          <ThemedText
                            lightColor={
                              isSelected ? theme.onPrimary : theme.text
                            }
                            darkColor={
                              isSelected ? theme.onPrimary : theme.text
                            }
                            style={[
                              styles.contextLabel,
                              isSelected && styles.contextLabelSelected,
                            ]}
                          >
                            {item.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            {measurementType === "weight" && (
              <MeasurementInput
                label="Peso"
                value={weight}
                onChangeText={(v) => { if (!pendingReadingId && !isSaving) { setWeight(v); setShowReview(false); } }}
                unit="kg"
                placeholder="78,5"
                inputColor={inputColor}
                borderColor={borderColor}
                textColor={theme.text}
                placeholderColor={theme.placeholder}
                decimal
              />
            )}
          </View>

          {!!validationError &&
            (measurementType === "blood_pressure"
              ? !!(systolic.trim() || diastolic.trim() || heartRate.trim())
              : measurementType === "glucose"
                ? !!glucose.trim()
                : !!weight.trim()) && (
              <ThemedText accessibilityRole="alert" style={{ color: "#C2410C" }}>
                {validationError}
              </ThemedText>
            )}

          <View style={styles.sectionHeading}>
            <View style={styles.stepBadge}>
              <ThemedText
                lightColor={BrandColors.onPrimary}
                darkColor={BrandColors.onPrimary}
                style={styles.stepBadgeText}
              >
                3
              </ThemedText>
            </View>
            <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
              Fecha y hora
            </ThemedText>
          </View>

          <View
            style={[
              styles.formCard,
              styles.dateCard,
              { backgroundColor: surfaceColor, borderColor },
            ]}
          >
            <View style={styles.dateField}>
              <ThemedText style={styles.inputLabel}>Fecha</ThemedText>
              <View
                style={[
                  styles.inputShell,
                  { backgroundColor: inputColor, borderColor },
                ]}
              >
                <MaterialCommunityIcons
                  name="calendar-outline"
                  size={21}
                  color={accentColor}
                />
                <TextInput
                  accessibilityLabel="Fecha de la medición"
                  onChangeText={(v) => { if (!pendingReadingId && !isSaving) { setDate(v); setShowReview(false); } }}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={theme.icon}
                  style={[styles.dateInput, { color: theme.text }]}
                  value={date}
                />
              </View>
            </View>
            <View style={styles.timeField}>
              <ThemedText style={styles.inputLabel}>Hora</ThemedText>
              <View
                style={[
                  styles.inputShell,
                  { backgroundColor: inputColor, borderColor },
                ]}
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={21}
                  color={accentColor}
                />
                <TextInput
                  accessibilityLabel="Hora de la medición"
                  onChangeText={(v) => { if (!pendingReadingId && !isSaving) { setTime(v); setShowReview(false); } }}
                  placeholder="HH:MM"
                  placeholderTextColor={theme.icon}
                  style={[styles.dateInput, { color: theme.text }]}
                  value={time}
                />
              </View>
            </View>
          </View>

          {showReview && formIsValid && (
            <View
              style={[
                styles.reviewCard,
                {
                  backgroundColor: surfaceColor,
                  borderColor: selectedColors.accent,
                },
              ]}
            >
              <View
                style={[
                  styles.reviewIcon,
                  { backgroundColor: selectedColors.background },
                ]}
              >
                <MaterialCommunityIcons
                  name={selectedOption.icon}
                  size={25}
                  color={selectedColors.accent}
                />
              </View>
              <View style={styles.reviewCopy}>
                <ThemedText style={styles.reviewEyebrow}>
                  REVISA ANTES DE GUARDAR
                </ThemedText>
                <ThemedText style={styles.reviewTitle}>
                  {selectedOption.label}
                </ThemedText>
                <ThemedText style={styles.reviewValue}>
                  {getSummaryValue()}
                </ThemedText>
                {contextLabel && (
                  <ThemedText
                    style={[styles.reviewMeta, { color: theme.icon }]}
                  >
                    {contextLabel}
                  </ThemedText>
                )}
                <ThemedText style={[styles.reviewMeta, { color: theme.icon }]}>
                  {date} · {time}
                </ThemedText>
              </View>
            </View>
          )} 

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !formIsValid || isSaving || completed }}
            disabled={!formIsValid || isSaving || completed}
            onPress={save}
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: formIsValid && !isSaving && !completed ? accentColor : theme.disabled },
              pressed && formIsValid && styles.pressed,
            ]}
          >
            <ThemedText
              lightColor={BrandColors.onPrimary}
              darkColor={BrandColors.onPrimary}
              style={styles.submitLabel}
            >
              {completed ? "Medición registrada" : isSaving ? "Procesando..." : pendingReadingId ? "Confirmar lectura pendiente" : showReview ? "Guardar medición" : "Revisar medición"}
            </ThemedText>
            <MaterialCommunityIcons
              name={showReview ? "check-circle-outline" : "arrow-right"}
              size={22}
              color={BrandColors.onPrimary}
            />
          </Pressable>

          <View style={styles.integrationNote}>
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={19}
              color={theme.icon}
            />
            <ThemedText style={[styles.integrationText, { color: theme.icon }]}>
              Verifica que los valores coincidan con tu dispositivo antes de
              continuar.
            </ThemedText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

type MeasurementInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  unit: string;
  placeholder: string;
  inputColor: string;
  borderColor: string;
  textColor: string;
  placeholderColor: string;
  decimal?: boolean;
};

function MeasurementInput({
  label,
  value,
  onChangeText,
  unit,
  placeholder,
  inputColor,
  borderColor,
  textColor,
  placeholderColor,
  decimal = false,
}: MeasurementInputProps) {
  return (
    <View style={styles.measurementField}>
      <ThemedText style={styles.inputLabel}>{label}</ThemedText>
      <View
        style={[
          styles.measurementInputShell,
          { backgroundColor: inputColor, borderColor },
        ]}
      >
        <TextInput
          accessibilityLabel={`${label} en ${unit}`}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          style={[styles.measurementInput, { color: textColor }]}
          value={value}
        />
        <ThemedText style={styles.unit}>{unit}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    gap: 17,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  hero: {
    backgroundColor: BrandColors.primary,
    borderRadius: 22,
    minHeight: 188,
    overflow: "hidden",
    padding: 20,
    position: "relative",
  },
  heroDecorationTop: {
    backgroundColor: BrandColors.heroHighlight,
    borderRadius: 80,
    height: 160,
    opacity: 0.5,
    position: "absolute",
    right: -52,
    top: -72,
    width: 160,
  },
  heroDecorationBottom: {
    backgroundColor: BrandColors.heroAccent,
    borderRadius: 65,
    bottom: -70,
    height: 130,
    left: -42,
    opacity: 0.3,
    position: "absolute",
    width: 130,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: BrandColors.overlayStrong,
    borderColor: BrandColors.overlayBorderStrong,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32,
    marginTop: 13,
  },
  heroDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
    maxWidth: 310,
  },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },
  stepBadge: {
    alignItems: "center",
    backgroundColor: BrandColors.primary,
    borderRadius: 10,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  stepBadgeText: { fontSize: 14, fontWeight: "800", lineHeight: 18 },
  sectionTitle: { fontSize: 19, fontWeight: "700", lineHeight: 25 },
  typeRow: { flexDirection: "row", gap: 9 },
  typeCard: {
    alignItems: "center",
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    gap: 7,
    minHeight: 112,
    padding: 12,
    position: "relative",
  },
  typeCardSelected: {
    shadowColor: BrandColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  typeIcon: {
    alignItems: "center",
    borderRadius: 11,
    height: 45,
    justifyContent: "center",
    width: 45,
  },
  typeLabel: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  checkIcon: { position: "absolute", right: 7, top: 7 },
  formCard: {
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 15,
    padding: 16,
    shadowColor: BrandColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 1,
  },
  twoColumns: { flexDirection: "row", gap: 12 },
  measurementField: { flex: 1, gap: 7 },
  fieldGroup: { gap: 7 },
  inputLabel: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  fieldHelp: { fontSize: 13, lineHeight: 19 },
  measurementInputShell: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 58,
    paddingHorizontal: 13,
  },
  measurementInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    minWidth: 48,
    paddingVertical: 12,
  },
  unit: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  contextOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 3,
  },
  contextButton: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  contextLabel: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  contextLabelSelected: { fontWeight: "700" },
  dateCard: { flexDirection: "row", gap: 12 },
  dateField: { flex: 1.45, gap: 7 },
  timeField: { flex: 1, gap: 7 },
  inputShell: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    minHeight: 54,
    paddingHorizontal: 12,
  },
  dateInput: { flex: 1, fontSize: 15, fontWeight: "600", paddingVertical: 10 },
  reviewCard: {
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 13,
    padding: 16,
  },
  reviewIcon: {
    alignItems: "center",
    borderRadius: 11,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  reviewCopy: { flex: 1 },
  reviewEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    lineHeight: 15,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 2,
  },
  reviewValue: {
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 27,
    marginTop: 2,
  },
  reviewMeta: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  submitButton: {
    alignItems: "center",
    borderRadius: 14,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 18,
  },
  submitLabel: { fontSize: 17, fontWeight: "800", lineHeight: 23 },
  integrationNote: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  integrationText: { flex: 1, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.76 },
});
