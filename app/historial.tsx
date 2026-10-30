import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MeasurementCard } from '@/components/measurement-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors } from '@/constants/theme';
import { useAppState } from '@/hooks/use-app-state';
import { useDemo } from '@/hooks/use-demo';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authSession } from '@/services/auth-session';
import { getApiErrorMessage } from '@/services/errors';
import { readingsService } from '@/services/readings';
import { historyCards, localDateRange, mergeHistoryPages, withoutStandalonePulse, type HistoryFilters } from '@/services/readings-history';
import type { ReadingResponse } from '@/types/api';
import type { Measurement, MeasurementFilter } from '@/types/measurement';

const FILTERS: { label: string; value: MeasurementFilter; code?: HistoryFilters['parameterCode'] }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Presión', value: 'blood_pressure', code: 'SBP' },
  { label: 'Glucosa', value: 'glucose', code: 'GLUCOSE' },
  { label: 'Peso', value: 'weight', code: 'WEIGHT' },
];

type MeasurementSection = { key: string; title: string; data: Measurement[] };
type HistoryView = {
  key: string;
  readings: ReadingResponse[];
  total: number;
  nextPage: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  failedPage: number | null;
};
const emptyHistory = (key: string): HistoryView => ({
  key, readings: [], total: 0, nextPage: 1, hasMore: false,
  loading: false, error: null, failedPage: null,
});
function getLocalDateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function formatSectionTitle(measuredAt: string) {
  const date = new Date(measuredAt);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (getLocalDateKey(date) === getLocalDateKey(now)) return 'Hoy';
  if (getLocalDateKey(date) === getLocalDateKey(yesterday)) return 'Ayer';
  return capitalize(new Intl.DateTimeFormat('es-CL', {
    day: 'numeric', month: 'long',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date));
}
function buildSections(measurements: Measurement[]): MeasurementSection[] {
  const ordered = [...measurements].sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt));
  const sections = new Map<string, MeasurementSection>();
  for (const measurement of ordered) {
    const key = getLocalDateKey(measurement.measuredAt);
    const section = sections.get(key);
    if (section) section.data.push(measurement);
    else sections.set(key, { key, title: formatSectionTitle(measurement.measuredAt), data: [measurement] });
  }
  return [...sections.values()];
}

export default function MeasurementHistoryScreen() {
  const router = useRouter();
  const { measurements: mockMeasurements } = useDemo();
  const { selectedPatient, permissions, sessionMode } = useAppState();
  const sessionSnapshot = useSyncExternalStore(authSession.subscribe, authSession.snapshot, authSession.snapshot);
  const [activeFilter, setActiveFilter] = useState<MeasurementFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDates, setAppliedDates] = useState<Pick<HistoryFilters, 'from' | 'to'>>({});
  const [dateError, setDateError] = useState<string | null>(null);
  const [result, setResult] = useState<HistoryView>(emptyHistory(''));
  const latestRequest = useRef(0);
  const inProgress = useRef(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const accentColor = theme.primary;
  const borderColor = theme.border;
  const surfaceColor = theme.surface;
  const isBackend = sessionMode === 'backend';
  const patientId = selectedPatient?.id ?? null;
  const canRead = Boolean(permissions.read && patientId);
  const parameterCode = FILTERS.find((f) => f.value === activeFilter)?.code;
  // Un cambio de cuenta, paciente, filtros o sesión invalida TODA la vista anterior.
  const key = JSON.stringify([sessionMode, sessionSnapshot.user?.id, authSession.generation(),
    patientId, canRead, parameterCode, appliedDates.from, appliedDates.to]);
  const visible = result.key === key ? result : emptyHistory(key);

  const loadPage = useCallback(async (page: number, forceRefresh: boolean) => {
    if (!isBackend || !patientId || !canRead || inProgress.current) return;
    inProgress.current = true;
    const requestNumber = ++latestRequest.current;
    setResult((prev) => ({ ...(page === 1 ? emptyHistory(key) : prev.key === key ? prev : emptyHistory(key)),
      key, loading: true, error: null, failedPage: null }));
    try {
      const response = await readingsService.list(patientId, page,
        { parameterCode, ...appliedDates }, forceRefresh);
      if (latestRequest.current !== requestNumber) return;
      setResult((prev) => {
        const previous = page === 1 || prev.key !== key ? [] : prev.readings;
        const readings = mergeHistoryPages(previous, response.items);
        return { key, readings, total: response.total,
          nextPage: page + 1, hasMore: page * response.size < response.total,
          loading: false, error: null, failedPage: null };
      });
    } catch (cause) {
      if (latestRequest.current !== requestNumber) return;
      setResult((prev) => ({ ...(page === 1 ? emptyHistory(key) : prev.key === key ? prev : emptyHistory(key)),
        key, loading: false, error: getApiErrorMessage(cause, 'No fue posible cargar el historial.'),
        failedPage: page }));
    } finally {
      if (latestRequest.current === requestNumber) inProgress.current = false;
    }
  }, [isBackend, patientId, canRead, key, parameterCode, appliedDates]);

  useEffect(() => {
    latestRequest.current += 1;
    inProgress.current = false;
    let active = true;
    // Diferir el estado inicial evita actualizar React sincrónicamente desde el efecto.
    void Promise.resolve().then(() => {
      if (active && isBackend && canRead) void loadPage(1, false);
    });
    return () => { active = false; latestRequest.current += 1; inProgress.current = false; };
  }, [isBackend, canRead, loadPage]);

  const sections = useMemo(() => {
    if (isBackend) return buildSections(withoutStandalonePulse(historyCards(visible.readings, parameterCode)));
    const filtered = withoutStandalonePulse(mockMeasurements).filter((m) =>
      (activeFilter === 'all' || m.type === activeFilter ||
        (activeFilter === 'blood_pressure' && m.type === 'single_pressure')) &&
      (!appliedDates.from || Date.parse(m.measuredAt) >= Date.parse(appliedDates.from)) &&
      (!appliedDates.to || Date.parse(m.measuredAt) <= Date.parse(appliedDates.to)));
    return buildSections(filtered);
  }, [isBackend, visible.readings, mockMeasurements, activeFilter, appliedDates, parameterCode]);

  const applyDates = () => {
    try { setAppliedDates(localDateRange(dateFrom, dateTo)); setDateError(null); }
    catch (cause) { setDateError(cause instanceof Error ? cause.message : 'Fechas inválidas.'); }
  };
  const initialLoading = isBackend && canRead && (visible.loading && visible.readings.length === 0 ||
    result.key !== key);
  const showError = Boolean(isBackend && visible.error);
  return (
    <ThemedView style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom + 20, 32) },
          sections.length === 0 && styles.emptyList,
        ]}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        refreshControl={isBackend && canRead ? <RefreshControl refreshing={visible.loading && visible.readings.length > 0}
          onRefresh={() => void loadPage(1, true)} /> : undefined}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.hero}>
              <View style={styles.heroDecorationTop} /><View style={styles.heroDecorationBottom} />
              <View style={styles.heroIcon}>
                <MaterialCommunityIcons name="clipboard-pulse-outline" size={30} color={BrandColors.onPrimary} />
              </View>
              <ThemedText lightColor={BrandColors.onPrimary} darkColor={BrandColors.onPrimary} style={styles.heroTitle}>
                Tus mediciones
              </ThemedText>
              <ThemedText lightColor={BrandColors.onPrimaryMuted} darkColor={BrandColors.onPrimaryMuted} style={styles.introduction}>
                Consulta el historial de presión arterial, glucosa y peso.
              </ThemedText>
            </View>
            <ThemedText accessibilityRole="header" style={styles.filterTitle}>Filtrar registros</ThemedText>
            <View accessibilityRole="tablist">
              <ScrollView horizontal contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false}>
                {FILTERS.map((filter) => {
                  const selected = activeFilter === filter.value;
                  return <Pressable key={filter.value} accessibilityRole="tab"
                    accessibilityState={{ selected }} accessibilityLabel={`Filtrar por ${filter.label}`}
                    onPress={() => setActiveFilter(filter.value)}
                    style={({ pressed }) => [styles.filterButton, {
                      backgroundColor: selected ? accentColor : surfaceColor,
                      borderColor: selected ? accentColor : borderColor,
                    }, pressed && styles.filterPressed]}>
                    <ThemedText style={[styles.filterLabel, selected && styles.filterLabelActive]}
                      lightColor={selected ? theme.onPrimary : theme.text}
                      darkColor={selected ? theme.onPrimary : theme.text}>{filter.label}</ThemedText>
                  </Pressable>;
                })}
              </ScrollView>
            </View>
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <ThemedText>Desde</ThemedText>
                <TextInput accessibilityLabel="Fecha desde" placeholder="AAAA-MM-DD" placeholderTextColor={theme.placeholder}
                  keyboardType="numbers-and-punctuation" value={dateFrom} onChangeText={setDateFrom}
                  style={[styles.dateInput, { color: theme.text, borderColor, backgroundColor: surfaceColor }]} />
              </View>
              <View style={styles.dateField}>
                <ThemedText>Hasta</ThemedText>
                <TextInput accessibilityLabel="Fecha hasta" placeholder="AAAA-MM-DD" placeholderTextColor={theme.placeholder}
                  keyboardType="numbers-and-punctuation" value={dateTo} onChangeText={setDateTo}
                  style={[styles.dateInput, { color: theme.text, borderColor, backgroundColor: surfaceColor }]} />
              </View>
            </View>
            {dateError && <ThemedText style={{ color: theme.danger }}>{dateError}</ThemedText>}
            <Pressable accessibilityRole="button" accessibilityLabel="Aplicar rango de fechas"
              onPress={applyDates} style={[styles.controlButton, { borderColor, backgroundColor: surfaceColor }]}>
              <ThemedText>Aplicar fechas</ThemedText>
            </Pressable>
            {isBackend && canRead && !initialLoading && !visible.error &&
              <ThemedText style={{ color: theme.icon }}>
                {visible.readings.length} de {visible.total} lecturas cargadas
              </ThemedText>}
          </View>
        }
        renderSectionHeader={({ section }) => <View style={styles.sectionHeader}>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>{section.title}</ThemedText>
          <View style={[styles.sectionRule, { backgroundColor: borderColor }]} />
        </View>}
        renderItem={({ item }) => {
          const readingId = item.readingId ?? item.id;
          return <Pressable accessibilityRole="button" accessibilityLabel="Ver detalle de la lectura"
            accessibilityHint="Abre la información completa de esta lectura"
            onPress={() => router.push({ pathname: '/lectura/[readingId]', params: { readingId } })}
            style={({ pressed }) => pressed && styles.readingPressed}>
            <MeasurementCard measurement={item} />
          </Pressable>;
        }}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        ListEmptyComponent={<View style={styles.emptyState}>
          {initialLoading ? <ActivityIndicator color={theme.primary} size="large" /> :
            <MaterialCommunityIcons name={showError ? 'alert-circle-outline' : 'clipboard-text-outline'}
              size={40} color={showError ? theme.danger : theme.icon} />}
          <ThemedText style={styles.emptyTitle}>
            {initialLoading ? 'Cargando historial...' : showError ? 'No se pudo cargar el historial' :
             isBackend && !canRead ? 'Sin permiso para consultar lecturas' : 'Aún no hay mediciones registradas.'}
          </ThemedText>
          <ThemedText style={[styles.emptyMessage, { color: theme.icon }]}>
            {showError ? visible.error : isBackend && !canRead ? 'Selecciona un paciente autorizado con permiso de lectura.' :
              initialLoading ? 'Consultando los datos del paciente seleccionado.' :
              'Las mediciones disponibles aparecerán aquí.'}
          </ThemedText>
          {showError && <Pressable accessibilityRole="button" accessibilityLabel="Reintentar historial"
            style={[styles.controlButton, { borderColor, backgroundColor: surfaceColor }]}
            onPress={() => void loadPage(visible.failedPage ?? 1, true)}><ThemedText>Reintentar</ThemedText></Pressable>}
          {isBackend && canRead && !initialLoading && !showError && <Pressable
            accessibilityRole="button" accessibilityLabel="Actualizar historial vacío"
            style={[styles.controlButton, { borderColor, backgroundColor: surfaceColor }]}
            onPress={() => void loadPage(1, true)}><ThemedText>Actualizar historial</ThemedText></Pressable>}
        </View>}
        ListFooterComponent={isBackend && canRead && visible.readings.length > 0 ?
          <View style={styles.footer}>
            {visible.error && <ThemedText style={{ color: theme.danger }}>{visible.error}</ThemedText>}
            {(visible.hasMore || visible.failedPage !== null) &&
              <Pressable accessibilityRole="button" accessibilityLabel={visible.error ? 'Reintentar carga de página' : 'Cargar más lecturas'}
                disabled={visible.loading} onPress={() => void loadPage(visible.failedPage ?? visible.nextPage, false)}
                style={[styles.controlButton, { backgroundColor: surfaceColor, borderColor }]}>
                {visible.loading ? <ActivityIndicator color={theme.primary} /> :
                  <ThemedText>{visible.error ? 'Reintentar' : 'Cargar más'}</ThemedText>}
              </Pressable>}
            <Pressable accessibilityRole="button" accessibilityLabel="Actualizar historial"
              disabled={visible.loading} onPress={() => void loadPage(1, true)}
              style={[styles.controlButton, { backgroundColor: surfaceColor, borderColor }]}>
              <ThemedText>Actualizar historial</ThemedText>
            </Pressable>
          </View> : null}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
  },
  emptyList: { flexGrow: 1 },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1, gap: 4 },
  dateInput: { minHeight: 44, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12 },
  controlButton: { minHeight: 44, paddingHorizontal: 15, paddingVertical: 10, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  footer: { gap: 12, paddingVertical: 22 },
  headerContent: {
    gap: 16,
    paddingTop: 16,
  },
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
  heroTitle: {
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 31,
    marginTop: 13,
  },
  introduction: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
    maxWidth: 305,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  filterButton: {
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 68,
    paddingHorizontal: 14,
    shadowColor: BrandColors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 7,
    elevation: 1,
  },
  filterPressed: { opacity: 0.78 },
  filterLabel: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  filterLabelActive: {
    fontWeight: '700',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  itemSeparator: { height: 9 },
  readingPressed: { opacity: 0.78 },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 27,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 6,
    textAlign: 'center',
  },
});
