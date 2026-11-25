import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { describeConfirmationReason, PENDING_POLL, type ReadingDetail, type DetailState, type DetailError } from '@/src/modules/monitoring/application/use-cases/reading-detail';
import { type ConfirmReadingError } from '@/src/modules/monitoring/application/use-cases/readings';
import { ReadingConfirmationModal } from '@/src/modules/monitoring/presentation/components/reading-confirmation';
import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';
import { BrandColors, StatusColors, type AppTheme } from '@/src/shared/presentation/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type MeasurementItem = ReadingDetail['measurements'][number];

type ParameterPresentation = { icon: IconName; label: string };

const PARAMETER_PRESENTATION: Record<string, ParameterPresentation> = {
  SBP: { icon: 'heart-pulse', label: 'Presión sistólica' },
  DBP: { icon: 'heart-pulse', label: 'Presión diastólica' },
  HEART_RATE: { icon: 'heart-outline', label: 'Frecuencia cardíaca' },
  GLUCOSE: { icon: 'water-outline', label: 'Glucosa' },
  WEIGHT: { icon: 'scale-bathroom', label: 'Peso' },
};

const EVALUATION_STATUS_LABELS: Record<string, string> = {
  NORMAL: 'Normal',
  ADVERTENCIA: 'Advertencia',
  ALERTA: 'Alerta',
  INFORMATIVA: 'Informativa',
  DATOS_INSUFICIENTES: 'Datos insuficientes',
  NO_APLICABLE: 'No aplicable',
  ENTRADA_INVALIDA: 'Entrada inválida',
};

const SEVERITY_LABELS: Record<string, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  MUY_ALTA: 'Muy alta',
};

function formatDate(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timestamp);
}

export function formatValue(measurement: MeasurementItem): string {
  const value = String(measurement.value).replace('.', ',');
  return `${value}${measurement.unit ? ` ${measurement.unit}` : ''}`;
}

function formatContext(context: string | null | undefined): string {
  switch (context) {
    case 'REST': return 'Reposo';
    case 'PREPRANDIAL': return 'Antes de comer';
    case 'POSTPRANDIAL': return 'Después de comer';
    default: return context || 'Sin contexto';
  }
}

function formatSource(source: string | undefined): string {
  switch (source) {
    case 'MANUAL': return 'Registro manual';
    case 'mobile':
    case 'MOBILE': return 'Aplicación móvil';
    case 'web':
    case 'WEB': return 'Aplicación web';
    case 'MOCK': return 'Origen no reconocido';
    default: return source || 'No informado';
  }
}

function readingStatusLabel(status: ReadingDetail['status']): string {
  switch (status) {
    case 'PENDING': return 'Evaluación pendiente';
    case 'REQUIRES_CONFIRMATION': return 'Requiere confirmación';
    case 'EVALUATED': return 'Evaluada';
    default: return status;
  }
}

function readingStatusColors(status: ReadingDetail['status']) {
  switch (status) {
    case 'REQUIRES_CONFIRMATION': return StatusColors.warning;
    case 'PENDING': return StatusColors.info;
    default: return StatusColors.neutral;
  }
}

function evaluationStatusColors(status: string) {
  switch (status) {
    case 'NORMAL': return StatusColors.normal;
    case 'ADVERTENCIA': return StatusColors.warning;
    case 'ALERTA': return StatusColors.danger;
    default: return StatusColors.neutral;
  }
}

export type ReadingDetailViewProps = {
  state: DetailState;
  theme: AppTheme;
  reading: ReadingDetail | null;
  loading: boolean;
  detailError: DetailError | null;
  isBackend: boolean;
  canRead: boolean;
  canConfirm: boolean;
  patientId: string | null;
  readingId: string | null;
  patientName?: string | null;
  recordedByLabel: string | null;
  bottomInset: number;
  confirmationOpen: boolean;
  summary: string;
  confirmBusy: boolean;
  confirmError: ConfirmReadingError | null;
  onRefresh: () => void;
  onOpenConfirmation: () => void;
  onConfirm: () => void;
  onCancelConfirmation: () => void;
  onRefreshConfirmation: () => void;
  onGoToHistory: () => void;
};

export function ReadingDetailView({ state, theme, reading, loading, detailError, isBackend, canRead, canConfirm, patientId, readingId, patientName, recordedByLabel, bottomInset, confirmationOpen, summary, confirmBusy, confirmError, onRefresh, onOpenConfirmation, onConfirm, onCancelConfirmation, onRefreshConfirmation, onGoToHistory }: ReadingDetailViewProps) {
  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.primary} size="large" />
        <ThemedText style={[styles.centeredText, { color: theme.mutedText }]}>Cargando detalle de lectura…</ThemedText>
      </ThemedView>
    );
  }

  if (!reading) {
    const message = !isBackend || !canRead || !patientId
      ? 'Selecciona un paciente con permiso para consultar sus mediciones.'
      : !readingId
        ? 'No se indicó la lectura que deseas abrir.'
        : detailError?.message ?? 'La lectura solicitada no está disponible.';

    return (
      <ThemedView style={styles.centered}>
        <View style={[styles.errorIcon, { backgroundColor: theme.dangerBackground }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={34} color={theme.danger} />
        </View>
        <ThemedText style={styles.errorTitle}>No se pudo mostrar la lectura</ThemedText>
        <ThemedText style={[styles.centeredText, { color: theme.mutedText }]}>{message}</ThemedText>
        {detailError?.kind === 'temporary' && !!patientId && !!readingId && (
          <ActionButton title="Reintentar" onPress={onRefresh} theme={theme} />
        )}
        <ActionButton title="Volver al historial" onPress={onGoToHistory} theme={theme} secondary />
      </ThemedView>
    );
  }

  const badgeColors = readingStatusColors(reading.status);
  const evaluation = reading.evaluation ?? null;
  const evaluationColors = evaluation ? evaluationStatusColors(evaluation.status) : StatusColors.neutral;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(bottomInset + 24, 36) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }>
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

        {detailError && (
          <View accessibilityRole="alert" style={[styles.notice, {
            backgroundColor: theme.dangerBackground, borderColor: theme.dangerBorder,
          }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.danger} />
            <ThemedText style={[styles.noticeText, { color: theme.danger }]}>
              No se pudo actualizar: {detailError.message} Se muestran los últimos datos recibidos.
            </ThemedText>
          </View>
        )}

        <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <InfoRow icon="account-outline" label="Paciente" value={patientName ?? reading.patientId} theme={theme} />
          <InfoRow icon="tag-outline" label="Contexto" value={formatContext(reading.context)} theme={theme} />
          <InfoRow icon="cellphone" label="Origen" value={formatSource(reading.source)} theme={theme} />
          {recordedByLabel && <InfoRow icon="account-check-outline" label="Registrado por" value={recordedByLabel} theme={theme} />}
          <InfoRow icon="identifier" label="ID de lectura" value={reading.readingId} compact theme={theme} />
        </View>

        <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>Estado de la lectura</ThemedText>
          <View style={[styles.statusBadge, { alignSelf: 'flex-start', backgroundColor: badgeColors.background }]}>
            <ThemedText style={[styles.statusText, { color: badgeColors.foreground }]}>
              {readingStatusLabel(reading.status)}
            </ThemedText>
          </View>
          {reading.status === 'PENDING' && (
            <>
              <ThemedText style={[styles.explanation, { color: theme.mutedText }]}>
                La evaluación se procesa en el servidor. Puedes actualizar para consultar el resultado.
              </ThemedText>
              {state.watching && (
                <ThemedText style={[styles.helper, { color: theme.mutedText }]}>
                  Consultando automáticamente ({state.autoChecks + 1} de {PENDING_POLL.maxChecks}).
                </ThemedText>
              )}
              {state.pollExhausted && (
                <ThemedText style={[styles.helper, { color: theme.mutedText }]}>
                  Todavía no hay resultado. Pulsa «Actualizar lectura» para consultar nuevamente.
                </ThemedText>
              )}
            </>
          )}
          {reading.status === 'REQUIRES_CONFIRMATION' && (
            <>
              <ThemedText style={[styles.explanation, { color: theme.mutedText }]}>
                El servicio solicita revisar estos valores antes de evaluarlos.
              </ThemedText>
              {reading.confirmationReasons.length > 0 ? reading.confirmationReasons.map((reason, index) => (
                <ThemedText key={`${reason}-${index}`} style={styles.explanation}>
                  • {describeConfirmationReason(reason)}
                </ThemedText>
              )) : (
                <ThemedText style={[styles.explanation, { color: theme.mutedText }]}>El servidor no informó motivos.</ThemedText>
              )}
              {canConfirm ? (
                <ActionButton title="Revisar y confirmar" onPress={onOpenConfirmation} theme={theme} />
              ) : (
                <ThemedText style={[styles.helper, { color: theme.mutedText }]}>
                  Tu cuenta no tiene permiso para confirmar esta lectura.
                </ThemedText>
              )}
            </>
          )}
          {reading.status === 'EVALUATED' && !evaluation && (
            <ThemedText style={[styles.explanation, { color: theme.mutedText }]}>
              La lectura está evaluada, pero el servicio no entregó detalles de la evaluación.
            </ThemedText>
          )}
          <ActionButton
            title={state.refreshing ? 'Actualizando…' : 'Actualizar lectura'}
            onPress={onRefresh}
            disabled={state.refreshing || state.loading}
            theme={theme}
          />
        </View>

        {evaluation && (
          <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText accessibilityRole="header" style={styles.sectionTitle}>Evaluación del servidor</ThemedText>
            <View style={[styles.statusBadge, { alignSelf: 'flex-start', backgroundColor: evaluationColors.background }]}>
              <ThemedText style={[styles.statusText, { color: evaluationColors.foreground }]}>
                {EVALUATION_STATUS_LABELS[evaluation.status] ?? evaluation.status}
              </ThemedText>
            </View>
            {evaluation.severity && (
              <InfoRow icon="alert-outline" label="Severidad" value={SEVERITY_LABELS[evaluation.severity] ?? evaluation.severity} theme={theme} />
            )}
            <ThemedText style={styles.explanation}>{evaluation.explanation || 'Sin explicación entregada por el servidor.'}</ThemedText>
            <InfoRow icon="clock-outline" label="Fecha de evaluación"
              value={evaluation.evaluatedAt ? formatDate(evaluation.evaluatedAt) : 'Sin fecha informada'} theme={theme} />
          </View>
        )}

        <View style={styles.sectionHeader}>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>Mediciones de esta lectura</ThemedText>
          <ThemedText style={[styles.sectionCount, { color: theme.mutedText }]}>{reading.measurements.length}</ThemedText>
        </View>
        <View style={styles.measurements}>
          {reading.measurements.map((measurement) => {
            const presentation = PARAMETER_PRESENTATION[measurement.parameterCode] ?? {
              icon: 'chart-line' as IconName,
              label: measurement.parameterCode,
            };
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
                    <ThemedText style={[styles.parameterCode, { color: theme.mutedText }]}>{measurement.parameterCode}</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.measurementValue}>{formatValue(measurement)}</ThemedText>
                {measurement.confirmedByUser && (
                  <View style={styles.confirmedRow}>
                    <MaterialCommunityIcons name="check-circle" size={16} color={StatusColors.normal.foreground} />
                    <ThemedText style={[styles.confirmedText, { color: StatusColors.normal.foreground }]}>
                      Confirmada por usuario
                    </ThemedText>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {confirmationOpen && reading && (
        <ReadingConfirmationModal
          visible
          reading={{
            patientId: reading.patientId,
            readingId: reading.readingId,
            status: reading.status,
            reasons: reading.confirmationReasons,
          }}
          summary={summary}
          busy={confirmBusy}
          error={confirmError}
          theme={theme}
          onConfirm={onConfirm}
          onCancel={onCancelConfirmation}
          onRefresh={onRefreshConfirmation}
          onGoToHistory={onGoToHistory}
        />
      )}
    </ThemedView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  theme,
  compact = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  theme: AppTheme;
  compact?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: theme.primarySoft }]}>
        <MaterialCommunityIcons name={icon} size={19} color={theme.primary} />
      </View>
      <View style={styles.infoCopy}>
        <ThemedText style={[styles.infoLabel, { color: theme.mutedText }]}>{label}</ThemedText>
        <ThemedText numberOfLines={compact ? 2 : undefined} style={compact ? styles.infoValueCompact : styles.infoValue}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

function ActionButton({
  title,
  onPress,
  theme,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  theme: AppTheme;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.retryButton,
        { backgroundColor: secondary ? theme.surface : theme.primary, borderColor: theme.border, opacity: disabled ? 0.6 : 1 },
        pressed && styles.pressed,
      ]}>
      <MaterialCommunityIcons name={secondary ? 'arrow-left' : 'refresh'} size={19} color={secondary ? theme.primary : theme.onPrimary} />
      <ThemedText style={[styles.retryText, { color: secondary ? theme.primary : theme.onPrimary }]}>{title}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingTop: 16 },
  centered: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 28 },
  centeredText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  hero: { backgroundColor: BrandColors.primary, borderRadius: 22, minHeight: 165, overflow: 'hidden', padding: 20, position: 'relative' },
  heroDecoration: { backgroundColor: BrandColors.heroHighlight, borderRadius: 80, height: 160, opacity: 0.45,
    position: 'absolute', right: -45, top: -75, width: 160 },
  heroIcon: { alignItems: 'center', backgroundColor: BrandColors.overlayStrong, borderColor: BrandColors.overlayBorderStrong,
    borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, height: 52, justifyContent: 'center', width: 52 },
  heroTitle: { fontSize: 25, fontWeight: '800', lineHeight: 31, marginTop: 14 },
  heroSubtitle: { fontSize: 15, lineHeight: 22, marginTop: 4 },
  summaryCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, gap: 14, padding: 16 },
  infoRow: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  infoIcon: { alignItems: 'center', borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  infoCopy: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  infoValue: { fontSize: 15, fontWeight: '600', lineHeight: 21, marginTop: 1 },
  infoValueCompact: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  sectionTitle: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  sectionCount: { fontSize: 14, fontWeight: '700' },
  measurements: { gap: 10 },
  measurementCard: { borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, gap: 13, padding: 16 },
  measurementTopRow: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  parameterIcon: { alignItems: 'center', borderRadius: 11, height: 44, justifyContent: 'center', width: 44 },
  parameterCopy: { flex: 1 },
  parameterLabel: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  parameterCode: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  measurementValue: { fontSize: 28, fontWeight: '800', lineHeight: 34 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  confirmedRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  confirmedText: { fontSize: 12, fontWeight: '600' },
  explanation: { fontSize: 14, lineHeight: 21 },
  helper: { fontSize: 12, lineHeight: 18 },
  notice: { alignItems: 'flex-start', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', gap: 9, padding: 13 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  errorIcon: { alignItems: 'center', borderRadius: 25, height: 50, justifyContent: 'center', width: 50 },
  errorTitle: { fontSize: 20, fontWeight: '700', lineHeight: 27, textAlign: 'center' },
  retryButton: { alignItems: 'center', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 7, marginTop: 4,
    minHeight: 44, paddingHorizontal: 16 },
  retryText: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
