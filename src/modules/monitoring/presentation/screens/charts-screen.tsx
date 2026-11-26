import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState } from '@/src/core/presentation/session/use-app-state';
import { getApiErrorMessage } from '@/src/core/domain/errors';
import { getPatientMeasurements } from '@/src/modules/monitoring/application/ports/reading-query-port';
import type { MeasurementPointResponse } from '@/src/modules/monitoring/domain/reading-query';
import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';
import { BrandColors, Colors, MeasurementColors } from '@/src/shared/presentation/theme';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';

type ChartGroup = 'blood_pressure' | 'glucose' | 'weight';
type SeriesCode = 'SBP' | 'DBP' | 'HEART_RATE' | 'GLUCOSE' | 'WEIGHT';
type DateFilters = { from?: string; to?: string };
type ViewState = {
  key: string;
  loading: boolean;
  points: MeasurementPointResponse[];
  error: string | null;
};

const OPTIONS: {
  value: ChartGroup;
  label: string;
  icon: 'heart-pulse' | 'water-outline' | 'scale-bathroom';
}[] = [
  { value: 'blood_pressure', label: 'Presión', icon: 'heart-pulse' },
  { value: 'glucose', label: 'Glucosa', icon: 'water-outline' },
  { value: 'weight', label: 'Peso', icon: 'scale-bathroom' },
];
const CODES: Record<ChartGroup, readonly SeriesCode[]> = {
  blood_pressure: ['SBP', 'DBP', 'HEART_RATE'],
  glucose: ['GLUCOSE'],
  weight: ['WEIGHT'],
};
const SERIES_NAMES: Record<SeriesCode, string> = {
  SBP: 'Sistólica',
  DBP: 'Diastólica',
  HEART_RATE: 'Frecuencia cardíaca (pulso)',
  GLUCOSE: 'Glucosa',
  WEIGHT: 'Peso',
};
const UNITS: Record<SeriesCode, string> = {
  SBP: 'mmHg',
  DBP: 'mmHg',
  HEART_RATE: 'bpm',
  GLUCOSE: 'mg/dL',
  WEIGHT: 'kg',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}
function shortDate(value: string): string {
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit' }).format(new Date(value));
}

/** Las fechas que introduce el usuario corresponden a días locales completos. */
function localDateRange(from: string, to: string): DateFilters {
  function parse(raw: string, endOfDay: boolean): string | undefined {
    const value = raw.trim();
    if (!value) return undefined;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new Error('Utiliza fechas con formato AAAA-MM-DD.');
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day,
      endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new Error('Una de las fechas ingresadas no existe.');
    }
    return date.toISOString();
  }
  const start = parse(from, false);
  const end = parse(to, true);
  if (start && end && start > end) throw new Error('La fecha desde no puede ser posterior a hasta.');
  return { from: start, to: end };
}

/** Validación de la respuesta real: no inventar puntos ni aceptar parámetros ajenos. */
function checkedSeries(
  raw: unknown,
  code: SeriesCode,
  dates: DateFilters,
): MeasurementPointResponse[] {
  if (!Array.isArray(raw)) throw new Error('El servidor devolvió una serie inválida.');
  const seen = new Set<string>();
  const points: MeasurementPointResponse[] = [];
  for (const entry of raw) {
    const point = entry as Partial<MeasurementPointResponse> | null;
    const measuredAt = point?.measuredAt;
    if (!point || typeof point.readingId !== 'string' || !point.readingId ||
      typeof measuredAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(measuredAt) ||
      !/(Z|[+-]\d{2}:\d{2})$/i.test(measuredAt) ||
      !Number.isFinite(Date.parse(measuredAt)) ||
      point.parameterCode !== code ||
      typeof point.value !== 'number' || !Number.isFinite(point.value) ||
      (point.unit !== null && point.unit !== UNITS[code]) ||
      (dates.from && Date.parse(measuredAt) < Date.parse(dates.from)) ||
      (dates.to && Date.parse(measuredAt) > Date.parse(dates.to))) {
      throw new Error('El servidor devolvió mediciones incompletas o inválidas.');
    }
    const identity = `${point.readingId}:${code}`;
    if (seen.has(identity)) throw new Error('El servidor devolvió mediciones duplicadas.');
    seen.add(identity);
    points.push({
      readingId: point.readingId,
      measuredAt,
      parameterCode: code,
      value: point.value,
      unit: point.unit,
    });
  }
  return points.sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt));
}

async function loadRealSeries(
  patientId: string,
  group: ChartGroup,
  dates: DateFilters,
): Promise<MeasurementPointResponse[]> {
  const responses = await Promise.all(CODES[group].map(async (parameterCode) => {
    const response = await getPatientMeasurements(patientId, { parameterCode, ...dates });
    return checkedSeries(response, parameterCode, dates);
  }));
  return responses.flat().sort((a, b) =>
    Date.parse(a.measuredAt) - Date.parse(b.measuredAt) || a.parameterCode.localeCompare(b.parameterCode));
}

export default function GraficosScreen() {
  const { selectedPatient, permissions, user, sessionMode } = useAppState();
  const insets = useSafeAreaInsets();
  const themeName = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = Colors[themeName];

  const [graphType, setGraphType] = useState<ChartGroup>('blood_pressure');
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [dates, setDates] = useState<DateFilters>({});
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [result, setResult] = useState<ViewState>({ key: '', loading: true, points: [], error: null });

  const isBackend = sessionMode === 'backend';
  const patientId = selectedPatient?.id ?? null;
  const canRead = Boolean(isBackend && user && patientId && permissions.read);
  const palette = MeasurementColors[themeName][graphType];
  const key = JSON.stringify([
    sessionMode, user?.id, patientId, canRead, graphType, dates.from, dates.to, refreshVersion,
  ]);
  const visible = result.key === key ? result : { key, loading: true, points: [], error: null };

  // Al entrar a la pantalla, cambiar filtros o actualizar, consulta solo el paciente actual.
  // La clave de resultado impide mostrar datos de otra cuenta/paciente.
  useFocusEffect(useCallback(() => {
    let active = true;
    if (isBackend && patientId && canRead) {
      void Promise.resolve().then(async () => {
        if (!active) return;
        setResult({ key, loading: true, points: [], error: null });
        try {
          const points = await loadRealSeries(patientId, graphType, dates);
          if (active) setResult({ key, loading: false, points, error: null });
        } catch (cause: unknown) {
          if (active) setResult({ key, loading: false, points: [],
            error: getApiErrorMessage(cause, 'No se pudieron consultar las mediciones.') });
        }
      });
    }
    return () => { active = false; };
  }, [isBackend, patientId, canRead, key, graphType, dates]));

  const points: MeasurementPointResponse[] = visible.loading || visible.error ? [] : visible.points;
  const byCode = (code: SeriesCode) => points.filter((point) => point.parameterCode === code);
  const summaryPoints = graphType === 'blood_pressure'
    ? points.filter((point) => point.parameterCode === 'SBP' || point.parameterCode === 'DBP')
    : points;
  const latest = [...summaryPoints].sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt));
  const latestPrimary = latest[0];
  const sameReading = latestPrimary
    ? points.filter((point) => point.readingId === latestPrimary.readingId &&
        point.measuredAt === latestPrimary.measuredAt)
    : [];
  const lastValue = graphType === 'blood_pressure' && latestPrimary
    ? `${sameReading.find((point) => point.parameterCode === 'SBP')?.value ?? '—'}/` +
      `${sameReading.find((point) => point.parameterCode === 'DBP')?.value ?? '—'}`
    : latestPrimary ? String(latestPrimary.value) : 'Sin datos';
  const lastUnit = latestPrimary?.unit ?? (latestPrimary ? 'Unidad no informada' : '');

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
      return <View style={styles.emptySeries}>
        <ThemedText style={[styles.helper, { color: theme.icon }]}>
          No hay puntos de {SERIES_NAMES[code].toLowerCase()} para el rango seleccionado.
        </ThemedText>
      </View>;
    }
    const chartData = series.map((point) => ({
      value: point.value,
      label: shortDate(point.measuredAt),
      measuredAt: point.measuredAt,
      readingId: point.readingId,
      unit: point.unit,
    }));
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <LineChart
          data={chartData}
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
            pointerLabelComponent: (items: { measuredAt: string; value: number; unit: string | null }[]) => {
              const point = items?.[0];
              if (!point) return null;
              return <View style={[styles.pointer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <ThemedText style={styles.pointerDate}>{formatDate(point.measuredAt)}</ThemedText>
                <ThemedText style={styles.pointerValue}>
                  {point.value} {point.unit ?? '(unidad no informada)'}
                </ThemedText>
              </View>;
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
            const optionPalette = MeasurementColors[themeName][option.value];
            return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: selected }}
              onPress={() => setGraphType(option.value)}
              style={[styles.typeCard, { backgroundColor: theme.surface,
                borderColor: selected ? optionPalette.accent : theme.border }]}>
              <MaterialCommunityIcons name={option.icon} color={optionPalette.accent} size={27} />
              <ThemedText style={styles.typeLabel}>{option.label}</ThemedText>
              {selected && <MaterialCommunityIcons name="check-circle" size={17} color={optionPalette.accent} />}
            </Pressable>;
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
          {dateError && <ThemedText accessibilityRole="alert" style={styles.errorText}>{dateError}</ThemedText>}
          <Pressable accessibilityRole="button" onPress={applyDates}
            style={[styles.button, { backgroundColor: theme.primary }]}>
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
                <ThemedText accessibilityRole="alert" style={styles.errorText}>{visible.error}</ThemedText>
                <Pressable accessibilityRole="button" onPress={() => setRefreshVersion((v) => v + 1)}
                  style={[styles.button, { backgroundColor: theme.primary }]}>
                  <ThemedText style={styles.buttonText}>Reintentar</ThemedText>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <MaterialCommunityIcons name="chart-line-variant" size={27} color={palette.accent} />
                  <View style={styles.summaryBody}>
                    <ThemedText style={[styles.helper, { color: theme.icon }]}>Último registro disponible</ThemedText>
                    <ThemedText style={styles.summaryValue}>{lastValue} {lastUnit}</ThemedText>
                    {latestPrimary && <ThemedText style={styles.helper}>{formatDate(latestPrimary.measuredAt)}</ThemedText>}
                  </View>
                  {isBackend && (
                    <Pressable accessibilityRole="button" accessibilityLabel="Actualizar gráficos"
                      onPress={() => setRefreshVersion((v) => v + 1)}>
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
                    {CODES[graphType].filter((code) =>
                      code !== 'HEART_RATE' || byCode('HEART_RATE').length > 0).map((code) => (
                      <View key={code} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <ThemedText style={styles.seriesTitle}>{SERIES_NAMES[code]}</ThemedText>
                        <ThemedText style={[styles.helper, { color: theme.icon }]}>
                          {byCode(code).length} punto(s) · {byCode(code)[0]?.unit ?? 'unidad no informada'}
                        </ThemedText>
                        {renderSeries(code, code === 'SBP' ? '#E53935' : code === 'DBP' ? '#1E88E5' : palette.accent)}
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
            <View style={styles.infoNote}>
              <MaterialCommunityIcons name="information-outline" size={19} color={theme.icon} />
              <ThemedText style={[styles.infoText, { color: theme.icon }]}>
                Datos devueltos por Integra II. El servicio excluye las lecturas pendientes de confirmación; esta serie no está paginada.
                {' '}Cada serie de presión muestra solo los valores registrados, sin completar datos faltantes.
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
