import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, MeasurementColors } from '@/constants/theme';
import { useAppState } from '@/hooks/use-app-state';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDemo } from '@/hooks/use-demo';
import { authSession } from '@/services/auth-session';
import { getApiErrorMessage } from '@/services/errors';
import { localDateRange } from '@/services/readings-history';
import { demoMeasurementSeries, measurementSeriesService,
  type ChartGroup, type SeriesCode, type SeriesFilters } from '@/services/measurement-series';
import type { MeasurementPointResponse } from '@/types/api/reading';

const OPTIONS: { value: ChartGroup; label: string; icon: 'heart-pulse' | 'water-outline' | 'scale-bathroom' }[] = [
  { value: 'blood_pressure', label: 'Presión', icon: 'heart-pulse' },
  { value: 'glucose', label: 'Glucosa', icon: 'water-outline' },
  { value: 'weight', label: 'Peso', icon: 'scale-bathroom' },
];
const SERIES_NAMES: Record<SeriesCode, string> = {
  SBP: 'Sistólica', DBP: 'Diastólica', HEART_RATE: 'Frecuencia cardíaca',
  GLUCOSE: 'Glucosa', WEIGHT: 'Peso',
};
const formatDate = (value: string) => new Intl.DateTimeFormat('es-CL', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));
const shortDate = (value: string) => new Intl.DateTimeFormat('es-CL', {
  day: '2-digit', month: '2-digit',
}).format(new Date(value));

type ViewState = { key: string; loading: boolean; points: MeasurementPointResponse[]; error: string | null };
const empty = (key: string): ViewState => ({ key, loading: true, points: [], error: null });

export default function GraficosScreen() {
  const { measurements: mockMeasurements } = useDemo();
  const { selectedPatient, permissions, user, sessionMode } = useAppState();
  const session = useSyncExternalStore(authSession.subscribe, authSession.snapshot, authSession.snapshot);
  const insets = useSafeAreaInsets();
  const themeName = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = Colors[themeName];
  const [graphType, setGraphType] = useState<ChartGroup>('blood_pressure');
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [dates, setDates] = useState<SeriesFilters>({});
  const [result, setResult] = useState<ViewState>(empty(''));
  const sequence = useRef(0);
  const isBackend = sessionMode === 'backend';
  const patientId = selectedPatient?.id ?? null;
  const canRead = Boolean(user && patientId && permissions.read);
  const colors = MeasurementColors[themeName][graphType];
  // Invalida inmediatamente todo resultado anterior al cambiar sesión, paciente o filtros.
  const key = JSON.stringify([sessionMode, session.user?.id, authSession.generation(), patientId,
    canRead, graphType, dates.from, dates.to]);
  const visible = result.key === key ? result : empty(key);

  const load = useCallback(async (forceRefresh = false) => {
    if (!isBackend || !patientId || !canRead) return;
    const requestId = ++sequence.current;
    setResult({ key, loading: true, points: [], error: null });
    try {
      const points = await measurementSeriesService.list(patientId, graphType, dates, forceRefresh);
      if (sequence.current === requestId) setResult({ key, loading: false, points, error: null });
    } catch (cause) {
      if (sequence.current === requestId) setResult({ key, loading: false, points: [],
        error: getApiErrorMessage(cause) });
    }
  }, [isBackend, patientId, canRead, key, graphType, dates]);

  useEffect(() => {
    let active = true;
    // Evita actualizar estado síncronamente durante el efecto (regla React Compiler).
    Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; sequence.current += 1; };
  }, [load]);

  const mockPoints = useMemo(() => patientId && !isBackend && sessionMode === 'mock'
    ? demoMeasurementSeries(mockMeasurements, patientId, graphType, dates) : [],
    [mockMeasurements, patientId, isBackend, sessionMode, graphType, dates]);
  const points = isBackend ? (visible.loading || visible.error ? [] : visible.points) : mockPoints;
  const byCode = (code: SeriesCode) => points.filter((p) => p.parameterCode === code);
  const latest = points.length ? [...points].sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt)) : [];
  const latestPrimary = latest[0];
  const latestSecond = latestPrimary && graphType === 'blood_pressure'
    ? latest.find((p) => p.readingId === latestPrimary.readingId &&
      p.measuredAt === latestPrimary.measuredAt && p.parameterCode !== latestPrimary.parameterCode) : null;
  const lastValue = latestPrimary ? graphType === 'blood_pressure'
    ? latestPrimary.parameterCode === 'SBP'
      ? `${latestPrimary.value}/${latestSecond?.value ?? '—'}`
      : `${latestSecond?.value ?? '—'}/${latestPrimary.value}`
    : `${latestPrimary.value}` : 'Sin datos';
  const unit = latestPrimary?.unit ?? '';

  function applyDates() {
    try {
      const range = localDateRange(fromInput, toInput);
      setDateError(null);
      setDates(range);
    } catch (cause) {
      setDateError(cause instanceof Error ? cause.message : 'Rango de fechas inválido.');
    }
  }

  function renderSeries(code: SeriesCode, color: string) {
    const series = byCode(code);
    if (series.length === 0) {
      return (
        <View style={styles.emptySeries}>
          <ThemedText style={[styles.helper, { color: theme.icon }]}>
            No hay puntos de {SERIES_NAMES[code].toLowerCase()} para el rango seleccionado.
          </ThemedText>
        </View>
      );
    }
    const data = series.map((point) => ({
      value: point.value,
      label: shortDate(point.measuredAt),
      measuredAt: point.measuredAt,
      readingId: point.readingId,
      unit: point.unit,
    }));
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <LineChart
          data={data}
          width={Math.max(Dimensions.get('window').width - 115, series.length * 65)}
          spacing={65}
          initialSpacing={18}
          endSpacing={25}
          color={color}
          thickness={2.5}
          dataPointsColor={color}
          dataPointsRadius={5}
          hideRules={false}
          rulesColor={theme.border}
          xAxisColor={theme.border}
          yAxisColor={theme.border}
          yAxisTextStyle={{ color: theme.icon, fontSize: 11 }}
          xAxisLabelTextStyle={{ color: theme.icon, fontSize: 11 }}
          noOfSections={4}
          pointerConfig={{
            pointerColor: color,
            radius: 6,
            pointerStripWidth: 2,
            pointerStripColor: theme.border,
            activatePointersOnLongPress: false,
            activatePointersInstantlyOnTouch: true,
            persistPointer: true,
            pointerLabelWidth: 190,
            pointerLabelHeight: 88,
            autoAdjustPointerLabelPosition: true,
            pointerLabelComponent: (items: any[]) => {
              const point = items?.[0];
              if (!point) return null;
              return (
                <View style={[styles.pointer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <ThemedText style={styles.pointerDate}>{formatDate(point.measuredAt)}</ThemedText>
                  <ThemedText style={styles.pointerValue}>
                    {point.value} {point.unit ?? '(unidad no informada)'}
                  </ThemedText>
                </View>
              );
            },
          }}
          isAnimated
          animationDuration={450}
        />
      </ScrollView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 36) }]}>
        <ThemedText accessibilityRole="header" style={styles.topBarTitle}>Gráficos</ThemedText>
        <View style={styles.hero}>
          <MaterialCommunityIcons name="chart-line" size={32} color={BrandColors.onPrimary} />
          <ThemedText style={styles.heroTitle} lightColor={BrandColors.onPrimary} darkColor={BrandColors.onPrimary}>
            Evolución de tus mediciones
          </ThemedText>
          <ThemedText lightColor={BrandColors.onPrimaryMuted} darkColor={BrandColors.onPrimaryMuted}>
            Tendencias registradas del paciente seleccionado.
          </ThemedText>
        </View>

        <ThemedText style={styles.sectionTitle}>Tipo de medición</ThemedText>
        <View accessibilityRole="radiogroup" style={styles.typeRow}>
          {OPTIONS.map((option) => {
            const selected = graphType === option.value;
            const palette = MeasurementColors[themeName][option.value];
            return (
              <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: selected }}
                onPress={() => setGraphType(option.value)}
                style={[styles.typeCard, { backgroundColor: theme.surface,
                  borderColor: selected ? palette.accent : theme.border }]}>
                <MaterialCommunityIcons name={option.icon} color={palette.accent} size={27} />
                <ThemedText style={styles.typeLabel}>{option.label}</ThemedText>
                {selected && <MaterialCommunityIcons name="check-circle" size={17} color={palette.accent} />}
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.filterCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText style={styles.filterTitle}>Rango de fechas (opcional)</ThemedText>
          <View style={styles.dateRow}>
            <View style={styles.dateColumn}>
              <ThemedText style={styles.helper}>Desde</ThemedText>
              <TextInput value={fromInput} onChangeText={setFromInput} placeholder="AAAA-MM-DD"
                placeholderTextColor={theme.icon} autoCapitalize="none" accessibilityLabel="Fecha desde"
                style={[styles.input, { borderColor: theme.border, color: theme.text }]} />
            </View>
            <View style={styles.dateColumn}>
              <ThemedText style={styles.helper}>Hasta</ThemedText>
              <TextInput value={toInput} onChangeText={setToInput} placeholder="AAAA-MM-DD"
                placeholderTextColor={theme.icon} autoCapitalize="none" accessibilityLabel="Fecha hasta"
                style={[styles.input, { borderColor: theme.border, color: theme.text }]} />
            </View>
          </View>
          {dateError && <ThemedText style={styles.errorText}>{dateError}</ThemedText>}
          <Pressable onPress={applyDates} style={[styles.button, { backgroundColor: theme.primary }]}>
            <ThemedText style={styles.buttonText}>Aplicar fechas</ThemedText>
          </Pressable>
        </View>

        {!canRead ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={styles.sectionTitle}>
              {!user ? 'Inicia sesión' : !patientId ? 'Selecciona un paciente' : 'Acceso restringido'}
            </ThemedText>
            <ThemedText style={styles.helper}>Necesitas un paciente autorizado para consultar sus gráficos.</ThemedText>
          </View>
        ) : (
          <>
            {isBackend && visible.loading ? (
              <View style={styles.notice}><ActivityIndicator color={theme.primary} />
                <ThemedText>Cargando mediciones reales...</ThemedText></View>
            ) : isBackend && visible.error ? (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <ThemedText style={styles.sectionTitle}>No se pudieron cargar los gráficos</ThemedText>
                <ThemedText style={styles.errorText}>{visible.error}</ThemedText>
                <Pressable onPress={() => void load(true)} style={[styles.button, { backgroundColor: theme.primary }]}>
                  <ThemedText style={styles.buttonText}>Reintentar</ThemedText>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <MaterialCommunityIcons name="chart-line-variant" size={27} color={colors.accent} />
                  <View style={styles.summaryBody}>
                    <ThemedText style={[styles.helper, { color: theme.icon }]}>Último registro disponible</ThemedText>
                    <ThemedText style={styles.summaryValue}>{lastValue} {unit}</ThemedText>
                    {latestPrimary && <ThemedText style={styles.helper}>{formatDate(latestPrimary.measuredAt)}</ThemedText>}
                  </View>
                  {isBackend && (
                    <Pressable accessibilityLabel="Actualizar gráficos" onPress={() => void load(true)}>
                      <MaterialCommunityIcons name="refresh" size={25} color={theme.primary} />
                    </Pressable>
                  )}
                </View>
                {points.length === 0 ? (
                  <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <ThemedText style={styles.sectionTitle}>Aún no hay mediciones</ThemedText>
                    <ThemedText style={[styles.helper, { color: theme.icon }]}>
                      No se encontraron registros para este tipo y rango de fechas.
                    </ThemedText>
                  </View>
                ) : (
                  <>
                    <ThemedText style={styles.sectionTitle}>Evolución</ThemedText>
                    {(graphType === 'blood_pressure' ? (['SBP', 'DBP'] as const) :
                      graphType === 'glucose' ? (['GLUCOSE'] as const) : (['WEIGHT'] as const)).map((code) => (
                      <View key={code} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <ThemedText style={styles.seriesTitle}>{SERIES_NAMES[code]}</ThemedText>
                        <ThemedText style={[styles.helper, { color: theme.icon }]}>
                          {byCode(code).length} punto(s) · {byCode(code)[0]?.unit ?? 'unidad no informada'}
                        </ThemedText>
                        {renderSeries(code, code === 'SBP' ? '#E53935' : code === 'DBP' ? '#1E88E5' : colors.accent)}
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
            <View style={styles.infoNote}>
              <MaterialCommunityIcons name="information-outline" size={19} color={theme.icon} />
              <ThemedText style={[styles.infoText, { color: theme.icon }]}>
                {isBackend ? 'Datos devueltos por Integra II. El servicio omite las lecturas pendientes de confirmación. No incluye paginación.' :
                  'Estás viendo mediciones de demostración almacenadas en esta aplicación.'}
                {' '}Cada serie de presión muestra solo sus valores registrados, sin completar datos faltantes.
              </ThemedText>
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 17, paddingHorizontal: 16, paddingTop: 16 },
  topBarTitle: { fontSize: 18, fontWeight: '700', lineHeight: 26 },
  hero: { backgroundColor: BrandColors.primary, borderRadius: 22, padding: 22, gap: 10, minHeight: 165 },
  heroTitle: { fontSize: 25, fontWeight: '800', lineHeight: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeCard: { flex: 1, minHeight: 104, borderWidth: 1, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8 },
  typeLabel: { fontSize: 13, fontWeight: '700' },
  filterCard: { borderWidth: 1, borderRadius: 15, padding: 14, gap: 10 },
  filterTitle: { fontSize: 14, fontWeight: '700' },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateColumn: { flex: 1, gap: 5 },
  input: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, minHeight: 43, fontSize: 13 },
  button: { alignItems: 'center', justifyContent: 'center', borderRadius: 10, minHeight: 43,
    paddingHorizontal: 15 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  summary: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 13, padding: 17 },
  summaryBody: { flex: 1, gap: 4 },
  summaryValue: { fontSize: 24, fontWeight: '800' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 11 },
  seriesTitle: { fontWeight: '800', fontSize: 16 },
  helper: { fontSize: 13, lineHeight: 19 },
  notice: { flexDirection: 'row', gap: 10, justifyContent: 'center', alignItems: 'center', minHeight: 130 },
  errorText: { fontSize: 13, color: '#C1443A', lineHeight: 19 },
  emptySeries: { justifyContent: 'center', minHeight: 85 },
  pointer: { padding: 10, borderRadius: 10, borderWidth: 1, gap: 5 },
  pointerDate: { fontWeight: '700', fontSize: 12 },
  pointerValue: { fontSize: 15, fontWeight: '700' },
  infoNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 8 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 19 },
});
