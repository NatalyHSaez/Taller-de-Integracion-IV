import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { type AppTheme, StatusColors } from '@/src/shared/presentation/theme';
import type { AlertFilter, PatientAlert } from '@/src/modules/evaluation/domain/alert';
import type { AlertsState } from '@/src/modules/evaluation/application/patient-alerts';

type Colors2 = { background: string; foreground: string };

/** Severidad tal como la informa el backend (BAJA…MUY_ALTA) o el mock (ADVERTENCIA…). */
const SEVERITY: Record<string, { label: string; colors: Colors2 }> = {
  BAJA: { label: 'Severidad baja', colors: StatusColors.info },
  MEDIA: { label: 'Severidad media', colors: StatusColors.warning },
  ALTA: { label: 'Severidad alta', colors: StatusColors.danger },
  MUY_ALTA: { label: 'Severidad muy alta', colors: StatusColors.danger },
  INFORMATIVA: { label: 'Informativa', colors: StatusColors.info },
  ADVERTENCIA: { label: 'Advertencia', colors: StatusColors.warning },
  ALERTA: { label: 'Alerta', colors: StatusColors.danger },
};

export function severityOf(severity: string) {
  return SEVERITY[severity] ?? { label: severity || 'Sin severidad', colors: StatusColors.neutral };
}

export const STATUS_LABELS: Record<PatientAlert['status'], string> = {
  OPEN: 'Sin leer',
  READ: 'Leída',
};

const FILTERS: { value: AlertFilter; label: string; count: (c: NonNullable<AlertsState['counts']>) => number }[] = [
  { value: 'ALL', label: 'Todas', count: (c) => c.all },
  { value: 'OPEN', label: 'Sin leer', count: (c) => c.open },
  { value: 'READ', label: 'Leídas', count: (c) => c.read },
];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export type AlertsViewProps = {
  state: AlertsState;
  theme: AppTheme;
  onFilter: (filter: AlertFilter) => void;
  onMarkRead: (alertId: string) => void;
  onOpen: (alertId: string) => void;
  onRetry: () => void;
};

/** Filtros con contadores del backend (sin hooks: se puede probar). */
export function AlertFilters({ state, theme, onFilter }: Pick<AlertsViewProps, 'state' | 'theme' | 'onFilter'>) {
  return (
    <View style={styles.filters} accessibilityRole="tablist" accessibilityLabel="Filtrar alertas">
      {FILTERS.map((filter) => {
        const selected = state.filter === filter.value;
        const count = state.counts ? filter.count(state.counts) : null;
        return (
          <Pressable
            key={filter.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${filter.label}${count === null ? '' : `: ${count}`}`}
            onPress={() => onFilter(filter.value)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected ? theme.primary : theme.surface,
                borderColor: selected ? theme.primary : theme.border,
              },
              pressed && styles.pressed,
            ]}>
            <ThemedText
              lightColor={selected ? theme.onPrimary : theme.text}
              darkColor={selected ? theme.onPrimary : theme.text}
              style={[styles.chipText, selected && styles.bold]}>
              {filter.label}
              {count === null ? '' : ` (${count})`}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tarjeta de una alerta. */
export function AlertCard({
  alert,
  marking,
  theme,
  onMarkRead,
  onOpen,
}: {
  alert: PatientAlert;
  marking: boolean;
  theme: AppTheme;
  onMarkRead: (alertId: string) => void;
  onOpen: (alertId: string) => void;
}) {
  const severity = severityOf(alert.severity);
  const open = alert.status === 'OPEN';
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: severity.colors.foreground },
      ]}>
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: severity.colors.background }]}>
          <ThemedText style={[styles.badgeText, { color: severity.colors.foreground }]}>{severity.label}</ThemedText>
        </View>
        <ThemedText style={[styles.small, open ? styles.bold : null, { color: open ? theme.primary : theme.mutedText }]}>
          {STATUS_LABELS[alert.status]}
        </ThemedText>
      </View>
      <ThemedText style={styles.text}>{alert.explanation}</ThemedText>
      <ThemedText style={[styles.small, { color: theme.mutedText }]}>{formatDateTime(alert.createdAt)}</ThemedText>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver detalle de la alerta"
          onPress={() => onOpen(alert.id)}
          style={({ pressed }) => [styles.secondary, { borderColor: theme.border }, pressed && styles.pressed]}>
          <ThemedText style={[styles.buttonText, { color: theme.primary }]}>Ver detalle</ThemedText>
        </Pressable>
        {open && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Marcar como leída"
            accessibilityState={{ disabled: marking, busy: marking }}
            disabled={marking}
            onPress={() => onMarkRead(alert.id)}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: marking ? theme.disabled : theme.primary },
              pressed && styles.pressed,
            ]}>
            {marking ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.buttonText}>
                Marcar como leída
              </ThemedText>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Estado vacío, carga o error de la lista. */
export function AlertsEmpty({ state, theme, onRetry }: Pick<AlertsViewProps, 'state' | 'theme' | 'onRetry'>) {
  if (!state.patientId) {
    return <Message theme={theme} icon="account-search-outline" title="Selecciona un paciente." text='Elige en "Mis pacientes" a quién acompañas para ver sus alertas.' />;
  }
  if (state.loading) {
    return (
      <View style={styles.centered} accessibilityLabel="Cargando alertas">
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={[styles.muted, { color: theme.mutedText }]}>Cargando alertas…</ThemedText>
      </View>
    );
  }
  if (state.error && !state.loaded) {
    return (
      <Message
        theme={theme}
        icon={state.error.kind === 'network' ? 'cloud-alert-outline' : 'lock-outline'}
        title={
          state.error.kind === 'forbidden'
            ? 'Sin acceso a las alertas'
            : state.error.kind === 'session'
              ? 'Sesión expirada'
              : 'No se pudieron cargar las alertas'
        }
        text={state.error.message}
        action={state.error.kind === 'network' ? { label: 'Reintentar', onPress: onRetry } : undefined}
      />
    );
  }
  const text =
    state.filter === 'OPEN'
      ? 'No hay alertas sin leer.'
      : state.filter === 'READ'
        ? 'No hay alertas leídas.'
        : 'No hay alertas por ahora.';
  return <Message theme={theme} icon="bell-check-outline" title={text} text="Desliza hacia abajo para actualizar." />;
}

/** Detalle con los datos ya recibidos en la lista. */
export function AlertDetail({
  alert,
  marking,
  theme,
  onMarkRead,
  onOpenReading,
  onClose,
}: {
  alert: PatientAlert;
  marking: boolean;
  theme: AppTheme;
  onMarkRead: (alertId: string) => void;
  onOpenReading: (readingId: string) => void;
  onClose: () => void;
}) {
  const severity = severityOf(alert.severity);
  return (
    <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <ThemedText accessibilityRole="header" style={styles.title}>
        Detalle de la alerta
      </ThemedText>
      <View style={[styles.badge, { backgroundColor: severity.colors.background }]}>
        <ThemedText style={[styles.badgeText, { color: severity.colors.foreground }]}>{severity.label}</ThemedText>
      </View>
      <ThemedText style={styles.text}>{alert.explanation}</ThemedText>
      <Info label="Estado" value={STATUS_LABELS[alert.status]} theme={theme} />
      <Info label="Generada" value={formatDateTime(alert.createdAt)} theme={theme} />
      {alert.readAt && <Info label="Leída" value={formatDateTime(alert.readAt)} theme={theme} />}
      {!!alert.ruleCode && <Info label="Regla" value={alert.ruleCode} theme={theme} />}
      <ThemedText style={[styles.small, { color: theme.mutedText }]}>
        Esta alerta la generó el servicio de evaluación según las reglas configuradas. No reemplaza la
        indicación de tu equipo de salud.
      </ThemedText>
      <View style={styles.sheetActions}>
        {alert.status === 'OPEN' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Marcar como leída"
            accessibilityState={{ disabled: marking, busy: marking }}
            disabled={marking}
            onPress={() => onMarkRead(alert.id)}
            style={({ pressed }) => [styles.primary, { backgroundColor: marking ? theme.disabled : theme.primary }, pressed && styles.pressed]}>
            <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.buttonText}>
              {marking ? 'Marcando…' : 'Marcar como leída'}
            </ThemedText>
          </Pressable>
        )}
        {alert.readingId && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver la lectura"
            onPress={() => onOpenReading(alert.readingId as string)}
            style={({ pressed }) => [styles.secondary, { borderColor: theme.border }, pressed && styles.pressed]}>
            <ThemedText style={[styles.buttonText, { color: theme.primary }]}>Ver la lectura</ThemedText>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onClose}
          style={({ pressed }) => [styles.secondary, { borderColor: theme.border }, pressed && styles.pressed]}>
          <ThemedText style={[styles.buttonText, { color: theme.primary }]}>Cerrar</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function Info({ label, value, theme }: { label: string; value: string; theme: AppTheme }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText style={[styles.small, { color: theme.mutedText }]}>{label}</ThemedText>
      <ThemedText style={[styles.small, styles.bold, styles.infoValue]}>{value}</ThemedText>
    </View>
  );
}

function Message({
  theme,
  icon,
  title,
  text,
  action,
}: {
  theme: AppTheme;
  icon: 'account-search-outline' | 'cloud-alert-outline' | 'lock-outline' | 'bell-check-outline';
  title: string;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.centered}>
      <MaterialCommunityIcons name={icon} size={40} color={theme.icon} />
      <ThemedText style={styles.title}>{title}</ThemedText>
      <ThemedText style={[styles.muted, { color: theme.mutedText }]}>{text}</ThemedText>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={({ pressed }) => [styles.primary, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.buttonText}>
            {action.label}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  chipText: { fontSize: 15, lineHeight: 20 },
  bold: { fontWeight: '700' },
  card: { borderLeftWidth: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 8, padding: 14 },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  text: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  muted: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  title: { fontSize: 18, fontWeight: '700', lineHeight: 25, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { alignItems: 'center', borderRadius: 10, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  secondary: { alignItems: 'center', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  centered: { alignItems: 'center', gap: 8, padding: 24 },
  sheet: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, gap: 10, padding: 20 },
  sheetActions: { gap: 8, marginTop: 6 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  infoValue: { flex: 1, textAlign: 'right' },
  pressed: { opacity: 0.8 },
});
