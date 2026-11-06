import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReadingHistoryItem } from '@/components/history/reading-history-item';
import { MeasurementCard } from '@/components/measurement-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { type AppTheme, BrandColors, Colors } from '@/constants/theme';
import { useAppState } from '@/hooks/use-app-state';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDemo } from '@/hooks/use-demo';
import type { ReadingResponse } from '@/services/api';
import { createReadingsHistory, lastDaysRange } from '@/services/readings-history';
import type { Measurement, MeasurementFilter } from '@/types/measurement';

/** Filtro por parámetro: se envía como parameterCode. */
const PARAMETER_FILTERS: { label: string; code: string | null }[] = [
  { label: 'Todas', code: null },
  { label: 'Presión', code: 'SBP' },
  { label: 'Pulso', code: 'HEART_RATE' },
  { label: 'Glucosa', code: 'GLUCOSE' },
  { label: 'Peso', code: 'WEIGHT' },
];

/** Filtro por fecha: se envía como from (el límite superior lo fija el historial). */
const DATE_FILTERS: { label: string; days: number | null }[] = [
  { label: 'Todo', days: null },
  { label: 'Últimos 7 días', days: 7 },
  { label: 'Últimos 30 días', days: 30 },
  { label: 'Últimos 90 días', days: 90 },
];

const DEMO_FILTERS: { label: string; value: MeasurementFilter }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Presión', value: 'blood_pressure' },
  { label: 'Glucosa', value: 'glucose' },
  { label: 'Peso', value: 'weight' },
];

type Section<T> = { key: string; title: string; data: T[] };

function getLocalDateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatSectionTitle(measuredAt: string) {
  const date = new Date(measuredAt);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const key = getLocalDateKey(date);
  if (key === getLocalDateKey(today)) return 'Hoy';
  if (key === getLocalDateKey(yesterday)) return 'Ayer';
  const text = new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Agrupa por día local conservando el orden recibido (más reciente primero). */
function groupByDay<T extends { measuredAt: string }>(items: T[]): Section<T>[] {
  const sections = new Map<string, Section<T>>();
  for (const item of items) {
    const key = getLocalDateKey(item.measuredAt);
    const section = sections.get(key);
    if (section) section.data.push(item);
    else sections.set(key, { key, title: formatSectionTitle(item.measuredAt), data: [item] });
  }
  return Array.from(sections.values());
}

export default function MeasurementHistoryScreen() {
  const { sessionMode } = useAppState();
  return sessionMode === 'backend' ? <BackendHistory /> : <DemoHistory />;
}

/* -------------------------------------------------------------------------- */
/* Sesión real: GET /api/v1/patients/{patientId}/readings                      */
/* -------------------------------------------------------------------------- */

function BackendHistory() {
  const router = useRouter();
  const { selectedPatient } = useAppState();
  const { user: authUser } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const patientId = authUser?.roles.includes('PATIENT')
    ? authUser.id
    : authUser?.roles.includes('CAREGIVER')
      ? (selectedPatient?.id ?? null)
      : null;

  const history = useMemo(() => createReadingsHistory(), []);
  const state = useSyncExternalStore(history.subscribe, history.getState, history.getState);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  // Al cambiar de paciente los filtros vuelven a "Todo" (from = null).
  const datePreset = state.filters.from === null ? null : selectedDays;

  // Al cambiar de paciente se limpian caché y resultados (ver readings-history).
  useEffect(() => {
    void history.setPatient(patientId);
  }, [history, patientId]);

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

  function selectDate(days: number | null) {
    setSelectedDays(days);
    void history.setFilters(days === null ? { from: null, to: null } : lastDaysRange(days));
  }

  const sections = useMemo(() => groupByDay(state.items), [state.items]);
  const openReading = (readingId: string) =>
    router.push({ pathname: '/lectura/[readingId]', params: { readingId } });
  const hasFilters = state.filters.parameterCode !== null || datePreset !== null;

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
                accessibilityState={{ disabled: !patientId || state.refreshing || state.loading, busy: state.refreshing }}
                disabled={!patientId || state.refreshing || state.loading}
                onPress={() => void history.refresh()}
                style={({ pressed }) => [styles.refreshButton, { borderColor: theme.border }, pressed && styles.pressed]}>
                {state.refreshing ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <MaterialCommunityIcons name="refresh" size={18} color={theme.primary} />
                )}
                <ThemedText style={[styles.refreshLabel, { color: theme.primary }]}>Actualizar</ThemedText>
              </Pressable>
            </View>
            <Chips
              label="Tipo de medición"
              theme={theme}
              options={PARAMETER_FILTERS.map((option) => ({
                key: option.code ?? 'all',
                label: option.label,
                selected: state.filters.parameterCode === option.code,
                onPress: () => void history.setFilters({ parameterCode: option.code }),
              }))}
            />
            <Chips
              label="Periodo"
              theme={theme}
              options={DATE_FILTERS.map((option) => ({
                key: String(option.days ?? 'all'),
                label: option.label,
                selected: datePreset === option.days,
                onPress: () => selectDate(option.days),
              }))}
            />
            {state.error && state.items.length > 0 && (
              <ThemedText accessibilityRole="alert" style={[styles.inlineError, { color: theme.danger }]}>
                No se pudo actualizar: {state.error} Se muestran los últimos datos cargados.
              </ThemedText>
            )}
            {state.total > 0 && (
              <ThemedText style={[styles.count, { color: theme.mutedText }]}>
                {state.total === 1 ? '1 lectura' : `${state.total} lecturas`}
              </ThemedText>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} theme={theme} />}
        renderItem={({ item }) => <ReadingHistoryItem reading={item} theme={theme} onOpen={openReading} />}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          !patientId ? (
            <EmptyState
              theme={theme}
              icon="account-search-outline"
              title="Selecciona un paciente."
              message='Elige en "Mis pacientes" a quién acompañas para ver sus lecturas.'
            />
          ) : state.loading ? (
            <View style={styles.emptyState} accessibilityLabel="Cargando historial">
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText style={[styles.emptyMessage, { color: theme.mutedText }]}>Cargando lecturas…</ThemedText>
            </View>
          ) : state.error ? (
            <EmptyState
              theme={theme}
              icon="cloud-alert-outline"
              title="No se pudo cargar el historial."
              message={state.error}
              action={{ label: 'Reintentar', onPress: () => void history.retry() }}
            />
          ) : (
            <EmptyState
              theme={theme}
              icon="clipboard-text-outline"
              title={hasFilters ? 'No hay lecturas con estos filtros.' : 'Aún no hay lecturas registradas.'}
              message={
                hasFilters
                  ? 'Prueba con otro tipo de medición o un periodo más amplio.'
                  : 'Las lecturas que se registren aparecerán aquí.'
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
              <ThemedText accessibilityRole="alert" style={[styles.inlineError, { color: theme.danger }]}>
                {state.loadMoreError}
              </ThemedText>
              <FooterButton label="Reintentar" theme={theme} onPress={() => void history.loadMore()} />
            </View>
          ) : state.hasMore ? (
            <View style={styles.footer}>
              <FooterButton label="Cargar más" theme={theme} onPress={() => void history.loadMore()} />
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
/* Sesión de demostración (sin servidor): datos locales                       */
/* -------------------------------------------------------------------------- */

function DemoHistory() {
  const router = useRouter();
  const { measurements } = useDemo();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<MeasurementFilter>('all');

  const sections = useMemo(() => {
    const filtered =
      activeFilter === 'all' ? measurements : measurements.filter((item) => item.type === activeFilter);
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
    );
    return groupByDay(sorted);
  }, [activeFilter, measurements]);

  return (
    <ThemedView style={styles.screen}>
      <SectionList<Measurement, Section<Measurement>>
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom + 20, 32) },
          sections.length === 0 && styles.emptyList,
        ]}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <Hero />
            <ThemedText accessibilityRole="header" style={styles.filterTitle}>
              Filtrar registros
            </ThemedText>
            <Chips
              label="Tipo de medición"
              theme={theme}
              options={DEMO_FILTERS.map((option) => ({
                key: option.value,
                label: option.label,
                selected: activeFilter === option.value,
                onPress: () => setActiveFilter(option.value),
              }))}
            />
          </View>
        }
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} theme={theme} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver detalle de la lectura"
            onPress={() =>
              router.push({ pathname: '/lectura/[readingId]', params: { readingId: item.readingId ?? item.id } })
            }
            style={({ pressed }) => pressed && styles.pressed}>
            <MeasurementCard measurement={item} />
          </Pressable>
        )}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          <EmptyState
            theme={theme}
            icon="clipboard-text-outline"
            title="Aún no hay mediciones registradas."
            message="Las mediciones que registres aparecerán aquí."
          />
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
  return Colors[colorScheme === 'dark' ? 'dark' : 'light'];
}

function Hero() {
  return (
    <View style={styles.hero}>
      <View style={styles.heroDecorationTop} />
      <View style={styles.heroDecorationBottom} />
      <View style={styles.heroIcon}>
        <MaterialCommunityIcons name="clipboard-pulse-outline" size={30} color={BrandColors.onPrimary} />
      </View>
      <ThemedText lightColor={BrandColors.onPrimary} darkColor={BrandColors.onPrimary} style={styles.heroTitle}>
        Tus mediciones
      </ThemedText>
      <ThemedText lightColor={BrandColors.onPrimaryMuted} darkColor={BrandColors.onPrimaryMuted} style={styles.introduction}>
        Revisa tus registros de presión, glucosa y peso de manera simple y ordenada.
      </ThemedText>
    </View>
  );
}

function Chips({
  label,
  options,
  theme,
}: {
  label: string;
  options: { key: string; label: string; selected: boolean; onPress: () => void }[];
  theme: AppTheme;
}) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label}>
      <ScrollView horizontal contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false}>
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
                backgroundColor: option.selected ? theme.primary : theme.surface,
                borderColor: option.selected ? theme.primary : theme.border,
              },
              pressed && styles.pressed,
            ]}>
            <ThemedText
              style={[styles.filterLabel, option.selected && styles.filterLabelActive]}
              lightColor={option.selected ? theme.onPrimary : theme.text}
              darkColor={option.selected ? theme.onPrimary : theme.text}>
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
  icon: 'account-search-outline' | 'cloud-alert-outline' | 'clipboard-text-outline';
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name={icon} size={40} color={theme.icon} />
      <ThemedText style={styles.emptyTitle}>{title}</ThemedText>
      <ThemedText style={[styles.emptyMessage, { color: theme.mutedText }]}>{message}</ThemedText>
      {action && <FooterButton label={action.label} theme={theme} onPress={action.onPress} />}
    </View>
  );
}

function FooterButton({ label, theme, onPress }: { label: string; theme: AppTheme; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.footerButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
      <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.footerButtonText}>
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
  hero: {
    backgroundColor: BrandColors.primary,
    borderRadius: 22,
    minHeight: 176,
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
  },
  heroDecorationTop: {
    backgroundColor: BrandColors.heroHighlight,
    borderRadius: 75,
    height: 150,
    opacity: 0.5,
    position: 'absolute',
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
    position: 'absolute',
    width: 120,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: BrandColors.overlayStrong,
    borderColor: BrandColors.overlayBorderStrong,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  heroTitle: { fontSize: 25, fontWeight: '800', lineHeight: 31, marginTop: 13 },
  introduction: { fontSize: 15, lineHeight: 22, marginTop: 5, maxWidth: 305 },
  filterHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  filterTitle: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  refreshButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  refreshLabel: { fontSize: 15, fontWeight: '700' },
  filters: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  filterButton: {
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 68,
    paddingHorizontal: 14,
  },
  filterLabel: { fontSize: 15, fontWeight: '500', lineHeight: 20 },
  filterLabelActive: { fontWeight: '700' },
  inlineError: { fontSize: 14, lineHeight: 20 },
  count: { fontSize: 14, lineHeight: 20 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 10, marginTop: 22 },
  sectionTitle: { fontSize: 17, fontWeight: '700', lineHeight: 23 },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth },
  itemSeparator: { height: 9 },
  emptyState: { alignItems: 'center', gap: 8, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', lineHeight: 25, textAlign: 'center' },
  emptyMessage: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  footer: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  footerButton: { alignItems: 'center', borderRadius: 10, justifyContent: 'center', minHeight: 44, paddingHorizontal: 20 },
  footerButtonText: { fontSize: 16, fontWeight: '700' },
  endText: { fontSize: 14, lineHeight: 20, paddingVertical: 18, textAlign: 'center' },
  pressed: { opacity: 0.78 },
});
