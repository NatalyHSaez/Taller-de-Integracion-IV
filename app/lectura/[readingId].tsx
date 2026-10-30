import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, StatusColors } from '@/constants/theme';
import { useAppState } from '@/hooks/use-app-state';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getApiErrorMessage } from '@/services/errors';
import { authSession } from '@/services/auth-session';
import { confirmationReasonLabel, evaluationStatusLabel } from '@/services/reading-detail';
import { readingsService } from '@/services/readings';
import type { MeasurementResponse, ReadingResponse } from '@/types/api';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type ParameterPresentation = {
  icon: IconName;
  label: string;
};

const PARAMETER_PRESENTATION: Record<string, ParameterPresentation> = {
  SBP: { icon: 'heart-pulse', label: 'Presión sistólica' },
  DBP: { icon: 'heart-pulse', label: 'Presión diastólica' },
  HEART_RATE: { icon: 'heart-outline', label: 'Frecuencia cardíaca' },
  GLUCOSE: { icon: 'water-outline', label: 'Glucosa' },
  WEIGHT: { icon: 'scale-bathroom', label: 'Peso' },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatValue(measurement: MeasurementResponse) {
  const value = Number.isInteger(measurement.value)
    ? String(measurement.value)
    : String(measurement.value).replace('.', ',');
  return `${value}${measurement.unit ? ` ${measurement.unit}` : ''}`;
}

function formatContext(context: string | null) {
  switch (context) {
    case 'REST':
      return 'Reposo';
    case 'PREPRANDIAL':
      return 'Antes de comer';
    case 'POSTPRANDIAL':
      return 'Después de comer';
    default:
      return context || 'Sin contexto';
  }
}

function formatSource(source: string) {
  switch (source) {
    case 'MANUAL':
      return 'Registro manual';
    case 'mobile':
    case 'MOBILE':
      return 'Aplicación móvil';
    case 'web':
    case 'WEB':
      return 'Aplicación web';
    case 'MOCK':
      return 'Datos simulados';
    case 'MOCK_FALLBACK':
      return 'Datos simulados de respaldo';
    default:
      return source;
  }
}

/** El backend publica el estado en ReadingOut, no en cada MeasurementOut. */
function readingStatusLabel(status: ReadingResponse['status']) {
  switch (status) {
    case 'PENDING': return 'Evaluación pendiente';
    case 'REQUIRES_CONFIRMATION': return 'Requiere confirmación';
    case 'EVALUATED': return 'Evaluada';
  }
}

function readingStatusColors(status: ReadingResponse['status']) {
  switch (status) {
    case 'REQUIRES_CONFIRMATION': return StatusColors.warning;
    case 'PENDING':
    case 'EVALUATED': return StatusColors.neutral;
  }
}

export default function ReadingDetailScreen() {
  const { readingId: rawReadingId } = useLocalSearchParams<{ readingId: string | string[] }>();
  const readingId = Array.isArray(rawReadingId) ? rawReadingId[0] : rawReadingId;
  const { selectedPatient, permissions, sessionMode, user } = useAppState();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const patientId = selectedPatient?.id ?? null;
  const canRead = Boolean(patientId && permissions.read);
  const viewKey = JSON.stringify([sessionMode, user?.id, authSession.generation(), patientId, canRead, readingId]);
  const [result, setResult] = useState<{
    key: string; reading: ReadingResponse | null; loading: boolean; error: string | null;
  }>({ key: '', reading: null, loading: true, error: null });
  const requestSerial = useRef(0);
  const visible = result.key === viewKey ? result : { key: viewKey, reading: null, loading: true, error: null };

  const loadReading = useCallback(async (forceRefresh: boolean) => {
    const serial = ++requestSerial.current;
    setResult({ key: viewKey, reading: null, loading: true, error: null });
    if (!patientId || !readingId || !canRead || !sessionMode) {
      setResult({ key: viewKey, reading: null, loading: false,
        error: 'Selecciona un paciente con permiso para consultar sus mediciones.' });
      return;
    }
    try {
      const detail = await readingsService.detail(patientId, readingId, forceRefresh);
      if (serial !== requestSerial.current) return;
      setResult({ key: viewKey, reading: detail, loading: false, error: null });
    } catch (cause) {
      if (serial !== requestSerial.current) return;
      setResult({ key: viewKey, reading: null, loading: false,
        error: getApiErrorMessage(cause, 'No fue posible cargar el detalle de la lectura.') });
    }
  }, [viewKey, patientId, readingId, canRead, sessionMode]);

  useEffect(() => {
    // Diferir la carga evita setState sincrónico desde efectos y permite cancelar la respuesta anterior.
    let active = true;
    requestSerial.current += 1;
    void Promise.resolve().then(() => {
      if (active) void loadReading(false);
    });
    return () => { active = false; requestSerial.current += 1; };
  }, [loadReading]);

  const reading = visible.reading;
  if (visible.loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.primary} size="large" />
        <ThemedText style={[styles.centeredText, { color: theme.icon }]}>Cargando detalle de lectura...</ThemedText>
      </ThemedView>
    );
  }

  if (!reading || visible.error) {
    return (
      <ThemedView style={styles.centered}>
        <View style={[styles.errorIcon, { backgroundColor: theme.dangerBackground }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={34} color={theme.danger} />
        </View>
        <ThemedText style={styles.errorTitle}>No se pudo mostrar la lectura</ThemedText>
        <ThemedText style={[styles.centeredText, { color: theme.icon }]}>
          {visible.error ?? 'La lectura solicitada no está disponible.'}
        </ThemedText>
        {canRead && <Pressable accessibilityRole="button" accessibilityLabel="Reintentar detalle"
          onPress={() => void loadReading(true)}
          style={[styles.retryButton, { backgroundColor: theme.primary }]}>
          <MaterialCommunityIcons name="refresh" size={20} color={theme.onPrimary} />
          <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.retryText}>Reintentar</ThemedText>
        </Pressable>}
      </ThemedView>
    );
  }

  const statusColors = readingStatusColors(reading.status);
  const evaluation = reading.evaluation;
  const evaluationColors = evaluation?.status === 'ALERTA' ? StatusColors.danger :
    evaluation?.status === 'ADVERTENCIA' ? StatusColors.warning : StatusColors.normal;
  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 36) }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroDecoration} />
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="clipboard-pulse-outline" size={31} color={BrandColors.onPrimary} />
          </View>
          <ThemedText lightColor={BrandColors.onPrimary} darkColor={BrandColors.onPrimary} style={styles.heroTitle}>
            Detalle de lectura
          </ThemedText>
          <ThemedText lightColor={BrandColors.onPrimaryMuted} darkColor={BrandColors.onPrimaryMuted} style={styles.heroSubtitle}>
            {formatDate(reading.measuredAt)}
          </ThemedText>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <InfoRow icon="account-outline" label="Paciente" value={selectedPatient?.name ?? reading.patientId} />
          <InfoRow icon="tag-outline" label="Contexto" value={formatContext(reading.context)} />
          <InfoRow icon="cellphone" label="Origen" value={formatSource(reading.source)} />
          <InfoRow icon="account-check-outline" label="Registrado por (ID)" value={reading.recordedBy} compact />
          <InfoRow icon="identifier" label="ID de lectura" value={reading.readingId} compact />
        </View>

        <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>Estado de la lectura</ThemedText>
          <View style={[styles.statusBadge, { alignSelf: 'flex-start', backgroundColor: statusColors.background }]}>
            <ThemedText style={[styles.statusText, { color: statusColors.foreground }]}>
              {readingStatusLabel(reading.status)}
            </ThemedText>
          </View>
          {reading.status === 'PENDING' && <ThemedText style={{ color: theme.icon }}>
            La evaluación del servidor está pendiente. Pulsa «Actualizar lectura» para consultar si ya terminó.
          </ThemedText>}
          {reading.status === 'REQUIRES_CONFIRMATION' && <>
            <ThemedText>El servidor requiere que se revise esta lectura antes de evaluarla.</ThemedText>
            {reading.confirmationReasons.length > 0 ? reading.confirmationReasons.map((reason, index) =>
              <ThemedText key={`${reason}-${index}`} style={{ color: theme.icon }}>
                • {confirmationReasonLabel(reason)}
              </ThemedText>) :
              <ThemedText style={{ color: theme.icon }}>El servidor no indicó un motivo específico.</ThemedText>}
            <ThemedText style={{ color: theme.icon }}>
              Esta pantalla no confirma mediciones automáticamente. La confirmación se abordará en un flujo separado.
            </ThemedText>
          </>}
          {reading.status === 'EVALUATED' && !evaluation && <ThemedText style={{ color: theme.icon }}>
            La lectura figura como evaluada, pero el servidor no entregó detalles de evaluación.
          </ThemedText>}
          <Pressable accessibilityRole="button" accessibilityLabel="Actualizar lectura"
            onPress={() => void loadReading(true)} style={[styles.retryButton, { backgroundColor: theme.primary, alignSelf: 'flex-start' }]}>
            <MaterialCommunityIcons name="refresh" size={20} color={theme.onPrimary} />
            <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.retryText}>Actualizar lectura</ThemedText>
          </Pressable>
        </View>

        {evaluation && <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>Evaluación del servidor</ThemedText>
          <View style={[styles.statusBadge, { alignSelf: 'flex-start', backgroundColor: evaluationColors.background }]}>
            <ThemedText style={[styles.statusText, { color: evaluationColors.foreground }]}>
              {evaluationStatusLabel(evaluation.status)}
            </ThemedText>
          </View>
          {evaluation.severity != null && <InfoRow icon="alert-outline" label="Severidad" value={evaluation.severity} />}
          <ThemedText>{evaluation.explanation || 'Sin explicación entregada por el servidor.'}</ThemedText>
          <InfoRow icon="clock-outline" label="Fecha de evaluación"
            value={evaluation.evaluatedAt ? formatDate(evaluation.evaluatedAt) : 'Sin fecha informada'} />
        </View>}

        <View style={styles.sectionHeader}>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>Mediciones de esta lectura</ThemedText>
          <ThemedText style={[styles.sectionCount, { color: theme.icon }]}>{reading.measurements.length}</ThemedText>
        </View>
        <View style={styles.measurements}>
          {reading.measurements.map((measurement) => {
            const presentation = PARAMETER_PRESENTATION[measurement.parameterCode] ??
              { icon: 'chart-line' as IconName, label: measurement.parameterCode };
            return (
              <View key={measurement.measurementId} style={[styles.measurementCard, {
                backgroundColor: theme.surface, borderColor: theme.border,
              }]}>
                <View style={styles.measurementTopRow}>
                  <View style={[styles.parameterIcon, { backgroundColor: theme.primarySoft }]}>
                    <MaterialCommunityIcons name={presentation.icon} size={24} color={theme.primary} />
                  </View>
                  <View style={styles.parameterCopy}>
                    <ThemedText style={styles.parameterLabel}>{presentation.label}</ThemedText>
                    <ThemedText style={[styles.parameterCode, { color: theme.icon }]}>{measurement.parameterCode}</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.measurementValue}>{formatValue(measurement)}</ThemedText>
                {measurement.confirmedByUser && <View style={styles.confirmedRow}>
                  <MaterialCommunityIcons name="check-circle" size={16} color={StatusColors.normal.foreground} />
                  <ThemedText style={[styles.confirmedText, { color: StatusColors.normal.foreground }]}>Confirmada por usuario</ThemedText>
                </View>}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  compact = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  compact?: boolean;
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: theme.primarySoft }]}>
        <MaterialCommunityIcons name={icon} size={19} color={theme.primary} />
      </View>
      <View style={styles.infoCopy}>
        <ThemedText style={[styles.infoLabel, { color: theme.icon }]}>{label}</ThemedText>
        <ThemedText numberOfLines={compact ? 2 : undefined} style={compact ? styles.infoValueCompact : styles.infoValue}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 28,
  },
  centeredText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  hero: {
    backgroundColor: BrandColors.primary,
    borderRadius: 22,
    minHeight: 165,
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
  },
  heroDecoration: {
    backgroundColor: BrandColors.heroHighlight,
    borderRadius: 80,
    height: 160,
    opacity: 0.45,
    position: 'absolute',
    right: -45,
    top: -75,
    width: 160,
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
    marginTop: 14,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
    padding: 16,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  infoIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  infoCopy: { flex: 1 },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 1,
  },
  infoValueCompact: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '700',
  },
  measurements: { gap: 10 },
  measurementCard: {
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 13,
    padding: 16,
  },
  measurementTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  parameterIcon: {
    alignItems: 'center',
    borderRadius: 11,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  parameterCopy: { flex: 1 },
  parameterLabel: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  parameterCode: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  measurementValue: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  measurementFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  confirmedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  confirmedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  notice: {
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 9,
    padding: 13,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  errorIcon: {
    alignItems: 'center',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 27,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 7,
    marginTop: 4,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: { opacity: 0.78 },
});
