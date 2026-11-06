import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { READING_STATUS_BADGES } from '@/components/history/reading-history-item';
import { ThemedText } from '@/components/themed-text';
import { type AppTheme, StatusColors } from '@/constants/theme';
import {
  type DetailState,
  describeConfirmationReason,
  parameterName,
  PENDING_POLL,
} from '@/services/reading-detail';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const CONTEXT_LABELS: Record<string, string> = {
  PREPRANDIAL: 'Antes de comer o en ayunas',
  POSTPRANDIAL: 'Después de comer',
};

const SOURCE_LABELS: Record<string, string> = {
  mobile: 'App móvil',
  web: 'Portal web',
  MOCK: 'Datos de demostración',
};

/** Resultado que informa el servicio de evaluación (no lo calcula la app). */
const EVALUATION_LABELS: Record<string, { label: string; colors: { background: string; foreground: string } }> = {
  NORMAL: { label: 'Normal', colors: StatusColors.normal },
  ADVERTENCIA: { label: 'Advertencia', colors: StatusColors.warning },
  ALERTA: { label: 'Alerta', colors: StatusColors.danger },
};

const SEVERITY_LABELS: Record<string, string> = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta' };

const STATUS_DESCRIPTIONS: Record<string, string> = {
  PENDING: 'La lectura quedó registrada y se está evaluando. La evaluación es asíncrona y puede tardar unos segundos.',
  REQUIRES_CONFIRMATION: 'El servicio no evaluará esta lectura hasta que se confirme que los valores son correctos.',
  EVALUATED: 'El servicio ya evaluó esta lectura.',
};

const ERROR_PRESENTATION: Record<string, { icon: IconName; title: string }> = {
  session: { icon: 'account-lock-outline', title: 'Sesión expirada' },
  forbidden: { icon: 'lock-outline', title: 'Sin acceso a esta lectura' },
  not_found: { icon: 'file-question-outline', title: 'Lectura no encontrada' },
  temporary: { icon: 'cloud-alert-outline', title: 'No se pudo cargar la lectura' },
  missing: { icon: 'account-search-outline', title: 'Falta información para abrir la lectura' },
};

function formatDateTime(value: string) {
  const text = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatNumber(value: number) {
  return String(value).replace('.', ',');
}

export type ReadingDetailViewProps = {
  state: DetailState;
  theme: AppTheme;
  currentUserId: string | null;
  /** Nombre de quien registró (cuidador, paciente o médico), si se pudo resolver. */
  recordedByLabel?: string | null;
  onRefresh: () => void;
  onConfirm: () => void;
  onGoToHistory: () => void;
};

/** Detalle de una lectura (sin hooks propios: se puede probar renderizándolo). */
export function ReadingDetailView({
  state,
  theme,
  currentUserId,
  recordedByLabel,
  onRefresh,
  onConfirm,
  onGoToHistory,
}: ReadingDetailViewProps) {
  const { reading } = state;

  if (state.loading && !reading) {
    return (
      <View style={styles.centered} accessibilityLabel="Cargando lectura">
        <ActivityIndicator color={theme.primary} size="large" />
        <ThemedText style={[styles.muted, { color: theme.mutedText }]}>Cargando lectura…</ThemedText>
      </View>
    );
  }

  if (!reading) {
    const error = state.error ?? { kind: 'temporary', message: 'No se pudo cargar la lectura.' };
    const presentation = ERROR_PRESENTATION[error.kind] ?? ERROR_PRESENTATION.temporary;
    return (
      <View style={styles.centered} accessibilityRole="alert">
        <View style={[styles.errorIcon, { backgroundColor: theme.dangerBackground }]}>
          <MaterialCommunityIcons name={presentation.icon} size={34} color={theme.danger} />
        </View>
        <ThemedText style={styles.errorTitle}>{presentation.title}</ThemedText>
        <ThemedText style={[styles.muted, { color: theme.mutedText }]}>{error.message}</ThemedText>
        {error.kind === 'temporary' && <PrimaryButton label="Reintentar" onPress={onRefresh} theme={theme} />}
        <SecondaryButton label="Volver al historial" onPress={onGoToHistory} theme={theme} />
      </View>
    );
  }

  const badge = READING_STATUS_BADGES[reading.status] ?? {
    label: reading.status,
    colors: StatusColors.neutral,
  };
  const recordedBy = recordedByLabel ?? (reading.recordedBy
    ? reading.recordedBy === currentUserId
      ? 'Tú'
      : 'Otra persona vinculada al paciente'
    : null);
  const evaluation = reading.evaluation ?? null;
  const evaluationLabel = evaluation ? EVALUATION_LABELS[evaluation.status] : undefined;

  return (
    <View style={styles.content}>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.badge, { backgroundColor: badge.colors.background }]}>
          <ThemedText style={[styles.badgeText, { color: badge.colors.foreground }]}>{badge.label}</ThemedText>
        </View>
        <ThemedText accessibilityRole="header" style={styles.date}>
          {formatDateTime(reading.measuredAt)}
        </ThemedText>
        <ThemedText style={[styles.text, { color: theme.mutedText }]}>
          {STATUS_DESCRIPTIONS[reading.status] ?? ''}
        </ThemedText>
      </View>

      {state.error && (
        <View
          accessibilityRole="alert"
          style={[styles.notice, { backgroundColor: theme.dangerBackground, borderColor: theme.dangerBorder }]}>
          <ThemedText style={[styles.text, { color: theme.danger }]}>
            No se pudo actualizar: {state.error.message} Se muestran los últimos datos recibidos.
          </ThemedText>
        </View>
      )}

      <Section title="Mediciones" theme={theme}>
        {reading.measurements.map((measurement) => (
          <View key={measurement.measurementId} style={styles.measurementRow}>
            <View style={styles.measurementName}>
              <ThemedText style={styles.text}>{parameterName(measurement.parameterCode)}</ThemedText>
              {measurement.confirmedByUser && (
                <ThemedText style={[styles.small, { color: theme.mutedText }]}>Valor confirmado</ThemedText>
              )}
            </View>
            <ThemedText style={styles.value}>
              {formatNumber(measurement.value)}
              {measurement.unit ? ` ${measurement.unit}` : ''}
            </ThemedText>
          </View>
        ))}
      </Section>

      <Section title="Datos del registro" theme={theme}>
        <InfoRow label="Contexto" value={reading.context ? (CONTEXT_LABELS[reading.context] ?? reading.context) : 'No aplica'} theme={theme} />
        <InfoRow label="Fuente" value={reading.source ? (SOURCE_LABELS[reading.source] ?? reading.source) : 'No informada'} theme={theme} />
        {recordedBy && <InfoRow label="Registrada por" value={recordedBy} theme={theme} />}
      </Section>

      {reading.status === 'REQUIRES_CONFIRMATION' && (
        <Section title="Confirmación pendiente" theme={theme}>
          <ThemedText style={[styles.text, { color: theme.mutedText }]}>
            Motivos informados por el servicio (no son un diagnóstico):
          </ThemedText>
          {reading.confirmationReasons.length > 0 ? (
            reading.confirmationReasons.map((reason, index) => (
              <ThemedText key={`${index}-${reason}`} style={styles.text}>
                • {describeConfirmationReason(reason)}
              </ThemedText>
            ))
          ) : (
            <ThemedText style={[styles.text, { color: theme.mutedText }]}>El servicio no informó motivos.</ThemedText>
          )}
          <PrimaryButton label="Revisar y confirmar" onPress={onConfirm} theme={theme} />
        </Section>
      )}

      <Section title="Evaluación" theme={theme}>
        {reading.status === 'EVALUATED' && evaluation ? (
          <>
            <View style={[styles.badge, { backgroundColor: (evaluationLabel?.colors ?? StatusColors.neutral).background }]}>
              <ThemedText style={[styles.badgeText, { color: (evaluationLabel?.colors ?? StatusColors.neutral).foreground }]}>
                {evaluationLabel?.label ?? evaluation.status}
              </ThemedText>
            </View>
            {evaluation.severity && (
              <InfoRow label="Severidad" value={SEVERITY_LABELS[evaluation.severity] ?? evaluation.severity} theme={theme} />
            )}
            {evaluation.explanation && <ThemedText style={styles.text}>{evaluation.explanation}</ThemedText>}
            {evaluation.evaluatedAt && (
              <ThemedText style={[styles.small, { color: theme.mutedText }]}>
                Evaluada el {formatDateTime(evaluation.evaluatedAt)}
              </ThemedText>
            )}
          </>
        ) : reading.status === 'EVALUATED' ? (
          <ThemedText style={[styles.text, { color: theme.mutedText }]}>
            El servicio no informó el resultado de la evaluación.
          </ThemedText>
        ) : reading.status === 'PENDING' ? (
          <>
            <ThemedText style={[styles.text, { color: theme.mutedText }]}>Evaluación en curso.</ThemedText>
            {state.watching && (
              <ThemedText accessibilityLiveRegion="polite" style={[styles.small, { color: theme.mutedText }]}>
                Consultando de nuevo automáticamente ({state.autoChecks + 1} de {PENDING_POLL.maxChecks}).
              </ThemedText>
            )}
            {state.pollExhausted && (
              <ThemedText accessibilityLiveRegion="polite" style={[styles.small, { color: theme.mutedText }]}>
                Aún no hay resultado. Toca &quot;Actualizar&quot; para volver a consultar.
              </ThemedText>
            )}
          </>
        ) : (
          <ThemedText style={[styles.text, { color: theme.mutedText }]}>
            Se evaluará cuando se confirme la lectura.
          </ThemedText>
        )}
      </Section>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Actualizar lectura"
        accessibilityState={{ disabled: state.refreshing, busy: state.refreshing }}
        disabled={state.refreshing}
        onPress={onRefresh}
        style={({ pressed }) => [styles.secondary, { borderColor: theme.border }, pressed && styles.pressed]}>
        {state.refreshing ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <ThemedText style={[styles.secondaryText, { color: theme.primary }]}>Actualizar</ThemedText>
        )}
      </Pressable>
      <SecondaryButton label="Volver al historial" onPress={onGoToHistory} theme={theme} />
    </View>
  );
}

function Section({ title, theme, children }: { title: string; theme: AppTheme; children: ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function InfoRow({ label, value, theme }: { label: string; value: string; theme: AppTheme }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText style={[styles.text, { color: theme.mutedText }]}>{label}</ThemedText>
      <ThemedText style={[styles.text, styles.infoValue]}>{value}</ThemedText>
    </View>
  );
}

function PrimaryButton({ label, onPress, theme }: { label: string; onPress: () => void; theme: AppTheme }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
      <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.primaryText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress, theme }: { label: string; onPress: () => void; theme: AppTheme }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, { borderColor: theme.border }, pressed && styles.pressed]}>
      <ThemedText style={[styles.secondaryText, { color: theme.primary }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  centered: { alignItems: 'center', flex: 1, gap: 10, justifyContent: 'center', padding: 24 },
  errorIcon: { alignItems: 'center', borderRadius: 18, height: 64, justifyContent: 'center', width: 64 },
  errorTitle: { fontSize: 20, fontWeight: '800', lineHeight: 26, textAlign: 'center' },
  muted: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, gap: 10, padding: 16 },
  notice: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  date: { fontSize: 20, fontWeight: '800', lineHeight: 26 },
  sectionTitle: { fontSize: 17, fontWeight: '700', lineHeight: 23 },
  text: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  value: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  measurementRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  measurementName: { flex: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  infoValue: { flex: 1, fontWeight: '600', textAlign: 'right' },
  primary: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
  primaryText: { fontSize: 16, fontWeight: '700' },
  secondary: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryText: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
