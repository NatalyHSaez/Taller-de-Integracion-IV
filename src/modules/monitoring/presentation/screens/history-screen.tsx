import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppState } from "@/src/core/presentation/session/use-app-state";
import { createReadingsHistory } from "@/src/modules/monitoring/application/use-cases/readings-history";
import type { ReadingResponse } from "@/src/modules/monitoring/domain/reading-query";
import { ReadingHistoryItem } from "@/src/modules/monitoring/presentation/components/reading-history-item";
import { ThemedText } from "@/src/shared/presentation/components/themed-text";
import { ThemedView } from "@/src/shared/presentation/components/themed-view";
import { useColorScheme } from "@/src/shared/presentation/hooks/use-color-scheme";
import {
  type AppTheme,
  BrandColors,
  Colors,
} from "@/src/shared/presentation/theme";

/** Filtro por parámetro: se envía como parameterCode. */
const PARAMETER_FILTERS: { label: string; code: string | null }[] = [
  { label: "Todas", code: null },
  { label: "Presión", code: "SBP" },
  { label: "Glucosa", code: "GLUCOSE" },
  { label: "Peso", code: "WEIGHT" },
];

type Section<T> = { key: string; title: string; data: T[] };

function getLocalDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatSectionTitle(measuredAt: string) {
  const date = new Date(measuredAt);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const key = getLocalDateKey(date);
  if (key === getLocalDateKey(today)) return "Hoy";
  if (key === getLocalDateKey(yesterday)) return "Ayer";
  const text = new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Agrupa por día local conservando el orden recibido (más reciente primero). */
function groupByDay<T extends { measuredAt: string }>(
  items: T[],
): Section<T>[] {
  const sections = new Map<string, Section<T>>();
  for (const item of items) {
    const key = getLocalDateKey(item.measuredAt);
    const section = sections.get(key);
    if (section) section.data.push(item);
    else
      sections.set(key, {
        key,
        title: formatSectionTitle(item.measuredAt),
        data: [item],
      });
  }
  return Array.from(sections.values());
}

/**
 * Las fechas se interpretan en la zona horaria local del dispositivo.
 * "Hasta" incluye el día completo, no solo las 00:00.
 */
function localDateRange(
  fromInput: string,
  toInput: string,
): { from: string | null; to: string | null } {
  const parse = (input: string, endOfDay: boolean): string | null => {
    const raw = input.trim();
    if (!raw) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) throw new Error("Utiliza fechas con formato AAAA-MM-DD.");
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    );
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      throw new Error("Una de las fechas ingresadas no existe.");
    }
    return parsed.toISOString();
  };
  const from = parse(fromInput, false);
  const to = parse(toInput, true);
  if (from && to && from > to) {
    throw new Error("La fecha desde no puede ser posterior a hasta.");
  }
  return { from, to };
}

export default function MeasurementHistoryScreen() {
  const { user, selectedPatient, permissions } = useAppState();
  // Una selección nueva crea un historial nuevo, sin conservar filtros o datos de otro paciente.
  const scope = `${user?.id ?? "sin-usuario"}:${selectedPatient?.id ?? "sin-paciente"}:${permissions.read}`;
  return <BackendHistory key={scope} />;
}

/* -------------------------------------------------------------------------- */
/* Sesión real: GET /api/v1/patients/{patientId}/readings                      */
/* -------------------------------------------------------------------------- */

function BackendHistory() {
  const router = useRouter();
  const { selectedPatient, permissions } = useAppState();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const patientId = selectedPatient?.id ?? null;
  const authorizedPatientId = permissions.read ? patientId : null;

  const history = useMemo(() => createReadingsHistory(), []);
  const state = useSyncExternalStore(
    history.subscribe,
    history.getState,
    history.getState,
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);

  // Al cambiar de paciente se limpian caché y resultados (ver readings-history).
  useEffect(() => {
    void history.setPatient(authorizedPatientId);
  }, [history, authorizedPatientId]);

  // Al volver a la pantalla (por ejemplo, tras registrar), se actualiza.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (history.getState().page > 0) void history.refresh();
    }, [history]),
  );

  function applyDates() {
    try {
      const range = localDateRange(dateFrom, dateTo);
      setDateError(null);
      void history.setFilters(range);
    } catch (cause) {
      setDateError(
        cause instanceof Error ? cause.message : "Rango de fechas inválido.",
      );
    }
  }

  // Ocultar las lecturas que contienen únicamente pulso. El backend conserva
  // sus datos, pero en Historial mostramos presión, glucosa y peso.
  const visibleReadings = useMemo(() => state.items.filter(reading =>
    reading.measurements.some(measurement =>
      ['SBP', 'DBP', 'GLUCOSE', 'WEIGHT'].includes(measurement.parameterCode)),
  ), [state.items]);
  const sections = useMemo(() => groupByDay(visibleReadings), [visibleReadings]);
  const openReading = (readingId: string) =>
    router.push({ pathname: "/lectura/[readingId]", params: { readingId } });
  const hasFilters =
    state.filters.parameterCode !== null ||
    state.filters.from !== null ||
    state.filters.to !== null;
  const awaitingFirstPage =
    !!authorizedPatientId &&
    (state.patientId !== authorizedPatientId || state.loading);

  return (
    <ThemedView style={styles.screen}>
      <SectionList<ReadingResponse, Section<ReadingResponse>>
        sections={sections}
        keyExtractor={(item) => item.readingId}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom + 20, 32) },
          sections.length === 0 && styles.emptyList,
        ]}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => void history.refresh()}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (!state.loadMoreError) void history.loadMore();
        }}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <Hero />
            <View style={styles.filterHeader}>
              <ThemedText accessibilityRole="header" style={styles.filterTitle}>
                Filtrar registros
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Actualizar historial"
                accessibilityState={{
                  disabled:
                    !authorizedPatientId || state.refreshing || state.loading,
                  busy: state.refreshing,
                }}
                disabled={
                  !authorizedPatientId || state.refreshing || state.loading
                }
                onPress={() => void history.refresh()}
                style={({ pressed }) => [
                  styles.refreshButton,
                  { borderColor: theme.border },
                  pressed && styles.pressed,
                ]}
              >
                {state.refreshing ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <MaterialCommunityIcons
                    name="refresh"
                    size={18}
                    color={theme.primary}
                  />
                )}
                <ThemedText
                  style={[styles.refreshLabel, { color: theme.primary }]}
                >
                  Actualizar
                </ThemedText>
              </Pressable>
            </View>
            <Chips
              label="Tipo de medición"
              theme={theme}
              options={PARAMETER_FILTERS.map((option) => ({
                key: option.code ?? "all",
                label: option.label,
                selected: state.filters.parameterCode === option.code,
                onPress: () =>
                  void history.setFilters({ parameterCode: option.code }),
              }))}
            />
            <DateControls
              theme={theme}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFrom={setDateFrom}
              onDateTo={setDateTo}
              onApply={applyDates}
              error={dateError}
            />
            {state.error && state.items.length > 0 && (
              <ThemedText
                accessibilityRole="alert"
                style={[styles.inlineError, { color: theme.danger }]}
              >
                No se pudo actualizar: {state.error} Se muestran los últimos
                datos cargados.
              </ThemedText>
            )}
            {visibleReadings.length > 0 && (
              <ThemedText style={[styles.count, { color: theme.mutedText }]}>
                {visibleReadings.length === 1 ? "1 lectura visible" : `${visibleReadings.length} lecturas visibles`}
              </ThemedText>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} theme={theme} />
        )}
        renderItem={({ item }) => (
          <ReadingHistoryItem
            reading={item}
            theme={theme}
            onOpen={openReading}
          />
        )}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          !authorizedPatientId ? (
            <EmptyState
              theme={theme}
              icon="account-search-outline"
              title={
                patientId
                  ? "Sin permiso para consultar lecturas."
                  : "Selecciona un paciente."
              }
              message={
                patientId
                  ? "Tu relación con este paciente no autoriza a visualizar sus mediciones."
                  : "Selecciona un paciente autorizado para consultar su historial."
              }
            />
          ) : awaitingFirstPage ? (
            <View
              style={styles.emptyState}
              accessibilityLabel="Cargando historial"
            >
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText
                style={[styles.emptyMessage, { color: theme.mutedText }]}
              >
                Cargando lecturas…
              </ThemedText>
            </View>
          ) : state.error ? (
            <EmptyState
              theme={theme}
              icon="cloud-alert-outline"
              title="No se pudo cargar el historial."
              message={state.error}
              action={{
                label: "Reintentar",
                onPress: () => void history.retry(),
              }}
            />
          ) : (
            <EmptyState
              theme={theme}
              icon="clipboard-text-outline"
              title={
                hasFilters
                  ? "No hay lecturas con estos filtros."
                  : "Aún no hay lecturas registradas."
              }
              message={
                hasFilters
                  ? "Prueba con otro tipo de medición o un periodo más amplio."
                  : "Las lecturas que se registren aparecerán aquí."
              }
            />
          )
        }
        ListFooterComponent={
          state.items.length === 0 ? null : state.loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : state.loadMoreError ? (
            <View style={styles.footer}>
              <ThemedText
                accessibilityRole="alert"
                style={[styles.inlineError, { color: theme.danger }]}
              >
                {state.loadMoreError}
              </ThemedText>
              <FooterButton
                label="Reintentar"
                theme={theme}
                onPress={() => void history.loadMore()}
              />
            </View>
          ) : state.hasMore ? (
            <View style={styles.footer}>
              <FooterButton
                label="Cargar más"
                theme={theme}
                onPress={() => void history.loadMore()}
              />
            </View>
          ) : (
            <ThemedText style={[styles.endText, { color: theme.mutedText }]}>
              No hay más lecturas.
            </ThemedText>
          )
        }
      />
    </ThemedView>
  );
}

/* -------------------------------------------------------------------------- */
/* Piezas compartidas                                                          */
/* -------------------------------------------------------------------------- */

function useTheme(): AppTheme {
  const colorScheme = useColorScheme();
  return Colors[colorScheme === "dark" ? "dark" : "light"];
}

function Hero() {
  return (
    <View style={styles.hero}>
      <View style={styles.heroDecorationTop} />
      <View style={styles.heroDecorationBottom} />
      <View style={styles.heroIcon}>
        <MaterialCommunityIcons
          name="clipboard-pulse-outline"
          size={30}
          color={BrandColors.onPrimary}
        />
      </View>
      <ThemedText
        lightColor={BrandColors.onPrimary}
        darkColor={BrandColors.onPrimary}
        style={styles.heroTitle}
      >
        Tus mediciones
      </ThemedText>
      <ThemedText
        lightColor={BrandColors.onPrimaryMuted}
        darkColor={BrandColors.onPrimaryMuted}
        style={styles.introduction}
      >
        Consulta el historial de presión arterial, glucosa y peso.
      </ThemedText>
    </View>
  );
}

/** Filtros de fecha de tu rama Cristian, compatibles con el historial paginado de main. */
function DateControls({
  theme,
  dateFrom,
  dateTo,
  onDateFrom,
  onDateTo,
  onApply,
  error,
}: {
  theme: AppTheme;
  dateFrom: string;
  dateTo: string;
  onDateFrom: (value: string) => void;
  onDateTo: (value: string) => void;
  onApply: () => void;
  error: string | null;
}) {
  return (
    <View style={styles.dateControls}>
      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <ThemedText>Desde</ThemedText>
          <TextInput
            accessibilityLabel="Fecha desde"
            placeholder="AAAA-MM-DD"
            placeholderTextColor={theme.placeholder}
            keyboardType="numbers-and-punctuation"
            value={dateFrom}
            onChangeText={onDateFrom}
            style={[
              styles.dateInput,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              },
            ]}
          />
        </View>
        <View style={styles.dateField}>
          <ThemedText>Hasta</ThemedText>
          <TextInput
            accessibilityLabel="Fecha hasta"
            placeholder="AAAA-MM-DD"
            placeholderTextColor={theme.placeholder}
            keyboardType="numbers-and-punctuation"
            value={dateTo}
            onChangeText={onDateTo}
            style={[
              styles.dateInput,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              },
            ]}
          />
        </View>
      </View>
      {error && (
        <ThemedText
          accessibilityRole="alert"
          style={[styles.inlineError, { color: theme.danger }]}
        >
          {error}
        </ThemedText>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aplicar rango de fechas"
        onPress={onApply}
        style={({ pressed }) => [
          styles.dateButton,
          { borderColor: theme.border, backgroundColor: theme.surface },
          pressed && styles.pressed,
        ]}
      >
        <ThemedText>Aplicar fechas</ThemedText>
      </Pressable>
    </View>
  );
}

function Chips({
  label,
  options,
  theme,
}: {
  label: string;
  options: {
    key: string;
    label: string;
    selected: boolean;
    onPress: () => void;
  }[];
  theme: AppTheme;
}) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label}>
      <ScrollView
        horizontal
        contentContainerStyle={styles.filters}
        showsHorizontalScrollIndicator={false}
      >
        {options.map((option) => (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: option.selected }}
            accessibilityLabel={`${label}: ${option.label}`}
            onPress={option.onPress}
            style={({ pressed }) => [
              styles.filterButton,
              {
                backgroundColor: option.selected
                  ? theme.primary
                  : theme.surface,
                borderColor: option.selected ? theme.primary : theme.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText
              style={[
                styles.filterLabel,
                option.selected && styles.filterLabelActive,
              ]}
              lightColor={option.selected ? theme.onPrimary : theme.text}
              darkColor={option.selected ? theme.onPrimary : theme.text}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, theme }: { title: string; theme: AppTheme }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <View style={[styles.sectionRule, { backgroundColor: theme.border }]} />
    </View>
  );
}

function Separator() {
  return <View style={styles.itemSeparator} />;
}

function EmptyState({
  theme,
  icon,
  title,
  message,
  action,
}: {
  theme: AppTheme;
  icon:
    | "account-search-outline"
    | "cloud-alert-outline"
    | "clipboard-text-outline";
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name={icon} size={40} color={theme.icon} />
      <ThemedText style={styles.emptyTitle}>{title}</ThemedText>
      <ThemedText style={[styles.emptyMessage, { color: theme.mutedText }]}>
        {message}
      </ThemedText>
      {action && (
        <FooterButton
          label={action.label}
          theme={theme}
          onPress={action.onPress}
        />
      )}
    </View>
  );
}

function FooterButton({
  label,
  theme,
  onPress,
}: {
  label: string;
  theme: AppTheme;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.footerButton,
        { backgroundColor: theme.primary },
        pressed && styles.pressed,
      ]}
    >
      <ThemedText
        lightColor={theme.onPrimary}
        darkColor={theme.onPrimary}
        style={styles.footerButtonText}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { paddingHorizontal: 16 },
  emptyList: { flexGrow: 1 },
  headerContent: { gap: 14, paddingTop: 16 },
  dateControls: { gap: 10 },
  dateRow: { flexDirection: "row", gap: 12 },
  dateField: { flex: 1, gap: 4 },
  dateInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 12,
  },
  dateButton: {
    minHeight: 44,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    backgroundColor: BrandColors.primary,
    borderRadius: 22,
    minHeight: 176,
    overflow: "hidden",
    padding: 20,
    position: "relative",
  },
  heroDecorationTop: {
    backgroundColor: BrandColors.heroHighlight,
    borderRadius: 75,
    height: 150,
    opacity: 0.5,
    position: "absolute",
    right: -45,
    top: -70,
    width: 150,
  },
  heroDecorationBottom: {
    backgroundColor: BrandColors.heroAccent,
    borderRadius: 60,
    bottom: -70,
    height: 120,
    left: -35,
    opacity: 0.3,
    position: "absolute",
    width: 120,
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
  heroTitle: { fontSize: 25, fontWeight: "800", lineHeight: 31, marginTop: 13 },
  introduction: { fontSize: 15, lineHeight: 22, marginTop: 5, maxWidth: 305 },
  filterHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  filterTitle: { fontSize: 18, fontWeight: "700", lineHeight: 24 },
  refreshButton: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  refreshLabel: { fontSize: 15, fontWeight: "700" },
  filters: { flexDirection: "row", gap: 8, paddingRight: 4 },
  filterButton: {
    alignItems: "center",
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 68,
    paddingHorizontal: 14,
    shadowColor: BrandColors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 7,
    elevation: 1,
  },
  filterLabel: { fontSize: 15, fontWeight: "500", lineHeight: 20 },
  filterLabelActive: { fontWeight: "700" },
  inlineError: { fontSize: 14, lineHeight: 20 },
  count: { fontSize: 14, lineHeight: 20 },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
    marginTop: 22,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", lineHeight: 23 },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth },
  itemSeparator: { height: 9 },
  emptyState: {
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 25,
    textAlign: "center",
  },
  emptyMessage: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  footer: { alignItems: "center", gap: 8, paddingVertical: 18 },
  footerButton: {
    alignItems: "center",
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 20,
  },
  footerButtonText: { fontSize: 16, fontWeight: "700" },
  endText: {
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 18,
    textAlign: "center",
  },
  pressed: { opacity: 0.78 },
});
