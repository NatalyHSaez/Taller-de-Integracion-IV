import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { useClinicalParameters } from "@/hooks/use-clinical-parameters";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { validateAgainstParameter } from "@/services/clinical-parameters";
import { demo } from "@/services/demo-store";
import type { ClinicalParameterCode, ClinicalParameterResponse } from "@/types/api";
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

/** Parámetros del catálogo que necesita cada tipo de formulario. */
const REQUIRED_PARAMETERS: Record<MeasurementType, ClinicalParameterCode[]> = {
  blood_pressure: ["SBP", "DBP", "HEART_RATE"],
  glucose: ["GLUCOSE"],
  weight: ["WEIGHT"],
};

function rangeHint(parameter: ClinicalParameterResponse) {
  const { technicalMin: min, technicalMax: max } = parameter;
  if (min !== null && max !== null) return `Rango válido: ${min}–${max}`;
  if (min !== null) return `Mínimo: ${min}`;
  if (max !== null) return `Máximo: ${max}`;
  return undefined;
}

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

function isPositiveNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return value.trim().length > 0 && Number.isFinite(parsed) && parsed > 0;
}

export default function RegisterMeasurementScreen() {
  const router = useRouter();
  const { selectedPatient: patient, user } = useAppState();
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
  const {
    catalog,
    loading: catalogLoading,
    error: catalogError,
    retry: retryCatalog,
  } = useClinicalParameters();

  const isTypeAvailable = (type: MeasurementType) =>
    !!catalog && REQUIRED_PARAMETERS[type].every((code) => !!catalog[code]);
  const typeAvailable = isTypeAvailable(measurementType);
  const parameter = (code: ClinicalParameterCode) => catalog?.[code];
  const unitOf = (code: ClinicalParameterCode) => parameter(code)?.unit ?? "";

  useEffect(() => {
    if (!catalog || isTypeAvailable(measurementType)) return;
    const firstAvailable = MEASUREMENT_OPTIONS.find((option) =>
      isTypeAvailable(option.value),
    );
    if (firstAvailable) setMeasurementType(firstAvailable.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  const fieldValues: Record<ClinicalParameterCode, string> = {
    SBP: systolic,
    DBP: diastolic,
    HEART_RATE: heartRate,
    GLUCOSE: glucose,
    WEIGHT: weight,
  };
  const fieldErrors: Partial<Record<ClinicalParameterCode, string>> = {};
  if (catalog) {
    for (const code of REQUIRED_PARAMETERS[measurementType]) {
      const definition = catalog[code];
      const message = definition
        ? validateAgainstParameter(definition, fieldValues[code])
        : null;
      if (message) fieldErrors[code] = message;
    }
  }
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  const accentColor = theme.primary;
  const surfaceColor = theme.surface;
  const borderColor = theme.border;
  const inputColor = theme.surfaceMuted;

  const formIsValid =
    typeAvailable &&
    !hasFieldErrors &&
    date.trim().length > 0 &&
    time.trim().length > 0 &&
    (measurementType === "blood_pressure"
      ? isPositiveNumber(systolic) &&
        isPositiveNumber(diastolic) &&
        isPositiveNumber(heartRate)
      : measurementType === "glucose"
        ? isPositiveNumber(glucose) && glucoseContext !== null
        : isPositiveNumber(weight));

  const selectedOption = MEASUREMENT_OPTIONS.find(
    (option) => option.value === measurementType,
  )!;
  const selectedColors = MeasurementColors[themeName][measurementType];

  function selectMeasurementType(value: MeasurementType) {
    setMeasurementType(value);
    setShowReview(false);
  }

  function getSummaryValue() {
    if (measurementType === "blood_pressure") {
      return `${systolic} / ${diastolic} ${unitOf("SBP")} · ${heartRate} ${unitOf("HEART_RATE")}`;
    }
    if (measurementType === "glucose") return `${glucose} ${unitOf("GLUCOSE")}`;
    return `${weight.replace(".", ",")} ${unitOf("WEIGHT")}`;
  }

  const contextLabel = GLUCOSE_CONTEXTS.find(
    (item) => item.value === glucoseContext,
  )?.label;
  function renderParameterInput(
    code: ClinicalParameterCode,
    value: string,
    onChangeText: (value: string) => void,
    placeholder: string,
    decimal = false,
  ) {
    const definition = parameter(code);
    if (!definition) return null;
    return (
      <MeasurementInput
        key={code}
        label={definition.name}
        value={value}
        onChangeText={onChangeText}
        unit={definition.unit}
        hint={rangeHint(definition)}
        error={fieldErrors[code]}
        placeholder={placeholder}
        inputColor={inputColor}
        borderColor={borderColor}
        textColor={theme.text}
        placeholderColor={theme.placeholder}
        decimal={decimal}
      />
    );
  }

  function save() {
    if (!formIsValid) return;
    if (!showReview) {
      setShowReview(true);
      return;
    }
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
      )
        throw new Error(
          "Revisa la fecha (dd/mm/aaaa) y hora (hh:mm); no pueden ser futuras.",
        );
      const number = (value: string) => Number(value.replace(",", "."));
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
        const diaSemana = measured.toLocaleDateString("es-CL", {
          weekday: "long",
        });
        const fecha = measured.toLocaleDateString("es-CL", {
          day: "numeric",
          month: "long",
        });
        const hora = measured.toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        });
        Speech.speak(
          `Datos registrados correctamente. ${detalle}. ${diaSemana} ${fecha}, a las ${hora}.`,
          { language: "es-CL", volume: demo.snapshot().vozVolumen },
        );
      }

      router.replace(demo.permissions().read ? "/historial" : "/(tabs)");
    } catch (e) {
      setSaveError((e as Error).message);
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
            Paciente: {patient?.name} · Registra: {user?.name}
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

          {catalogLoading && !catalog && (
            <View
              accessibilityLiveRegion="polite"
              style={[styles.statusCard, { backgroundColor: surfaceColor, borderColor }]}
            >
              <ActivityIndicator color={accentColor} />
              <ThemedText style={styles.statusText}>
                Cargando tipos de medición…
              </ThemedText>
            </View>
          )}

          {!catalogLoading && catalogError && (
            <View
              accessibilityRole="alert"
              style={[styles.statusCard, { backgroundColor: surfaceColor, borderColor }]}
            >
              <MaterialCommunityIcons
                name="cloud-alert-outline"
                size={26}
                color={theme.icon}
              />
              <ThemedText style={styles.statusText}>{catalogError}</ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={retryCatalog}
                style={({ pressed }) => [
                  styles.retryButton,
                  { backgroundColor: accentColor },
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText
                  lightColor={BrandColors.onPrimary}
                  darkColor={BrandColors.onPrimary}
                  style={styles.retryLabel}
                >
                  Reintentar
                </ThemedText>
              </Pressable>
            </View>
          )}

          {catalog && (
            <>
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
                const isAvailable = isTypeAvailable(option.value);
                const optionColors = MeasurementColors[themeName][option.value];
                return (
                  <Pressable
                    key={option.value}
                    accessibilityLabel={option.label}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: isSelected,
                      disabled: !isAvailable,
                    }}
                    disabled={!isAvailable}
                    onPress={() => selectMeasurementType(option.value)}
                    style={({ pressed }) => [
                      styles.typeCard,
                      {
                        backgroundColor: surfaceColor,
                        borderColor: isSelected
                          ? optionColors.accent
                          : borderColor,
                      },
                      isSelected && styles.typeCardSelected,
                      !isAvailable && styles.typeCardDisabled,
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
              {!typeAvailable && (
                <ThemedText style={[styles.fieldHelp, { color: theme.icon }]}>
                  Este tipo de medición no está disponible en el catálogo actual.
                </ThemedText>
              )}

              {typeAvailable && measurementType === "blood_pressure" && (
                <>
                  <View style={styles.twoColumns}>
                    {renderParameterInput("SBP", systolic, setSystolic, "120")}
                    {renderParameterInput("DBP", diastolic, setDiastolic, "80")}
                  </View>
                  {renderParameterInput("HEART_RATE", heartRate, setHeartRate, "72")}
                </>
              )}

              {typeAvailable && measurementType === "glucose" && (
                <>
                  {renderParameterInput("GLUCOSE", glucose, setGlucose, "105")}
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
                            onPress={() => setGlucoseContext(item.value)}
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

              {typeAvailable && measurementType === "weight" &&
                renderParameterInput("WEIGHT", weight, setWeight, "78,5", true)}
            </View>

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
                    onChangeText={setDate}
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
                    onChangeText={setTime}
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
              accessibilityState={{ disabled: !formIsValid }}
              disabled={!formIsValid}
              onPress={save}
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: formIsValid ? accentColor : theme.disabled },
                pressed && formIsValid && styles.pressed,
              ]}
            >
              <ThemedText
                lightColor={BrandColors.onPrimary}
                darkColor={BrandColors.onPrimary}
                style={styles.submitLabel}
              >
                {showReview ? "Guardar medición" : "Revisar medición"}
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
            </>
          )}
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
  hint?: string;
  error?: string;
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
  hint,
  error,
}: MeasurementInputProps) {
  return (
    <View style={styles.measurementField}>
      <ThemedText style={styles.inputLabel}>{label}</ThemedText>
      <View
        style={[
          styles.measurementInputShell,
          { backgroundColor: inputColor, borderColor: error ? "#C62828" : borderColor },
        ]}
      >
        <TextInput
          accessibilityLabel={`${label} en ${unit}`}
          accessibilityHint={error ?? hint}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          style={[styles.measurementInput, { color: textColor }]}
          value={value}
        />
        <ThemedText style={styles.unit}>{unit}</ThemedText>
      </View>
      {error ? (
        <ThemedText style={styles.fieldError}>{error}</ThemedText>
      ) : hint ? (
        <ThemedText style={styles.fieldHint}>{hint}</ThemedText>
      ) : null}
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
  typeCardDisabled: { opacity: 0.45 },
  fieldHint: { fontSize: 12, lineHeight: 16, opacity: 0.7 },
  fieldError: { color: "#C62828", fontSize: 12, fontWeight: "600", lineHeight: 16 },
  statusCard: {
    alignItems: "center",
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 20,
  },
  statusText: { fontSize: 15, lineHeight: 21, textAlign: "center" },
  retryButton: {
    borderRadius: 12,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  retryLabel: { fontSize: 15, fontWeight: "700" },
});
