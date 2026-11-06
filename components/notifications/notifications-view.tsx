import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { type AppTheme, StatusColors } from '@/constants/theme';
import type {
  AppNotification,
  NotificationFilter,
  NotificationsState,
} from '@/services/notifications';

export const NOTIFICATION_STATUS: Record<AppNotification['status'], { label: string; colors: { background: string; foreground: string } }> = {
  pending: { label: 'Pendiente', colors: StatusColors.warning },
  sent: { label: 'Enviada', colors: StatusColors.info },
  read: { label: 'Leída', colors: StatusColors.neutral },
};

const TYPE_LABELS: Record<string, string> = {
  alerta_clinica: 'Alerta clínica',
  CLINICAL_ALERT: 'Alerta clínica',
  RELATIONSHIP: 'Vínculos',
};

const FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'read', label: 'Leídas' },
];

/** Aviso fijo: no hay push. */
export const INTERNAL_NOTICE =
  'Estas notificaciones se consultan dentro de la app. No se envían como notificaciones push al teléfono.';

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function NotificationFilters({
  state,
  theme,
  onFilter,
}: {
  state: NotificationsState;
  theme: AppTheme;
  onFilter: (filter: NotificationFilter) => void;
}) {
  return (
    <View style={styles.filters} accessibilityRole="tablist" accessibilityLabel="Filtrar notificaciones">
      {FILTERS.map((filter) => {
        const selected = state.filter === filter.value;
        return (
          <Pressable
            key={filter.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`Filtrar: ${filter.label}`}
            onPress={() => onFilter(filter.value)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: selected ? theme.primary : theme.surface, borderColor: selected ? theme.primary : theme.border },
              pressed && styles.pressed,
            ]}>
            <ThemedText
              lightColor={selected ? theme.onPrimary : theme.text}
              darkColor={selected ? theme.onPrimary : theme.text}
              style={[styles.chipText, selected && styles.bold]}>
              {filter.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function NotificationItem({
  notification,
  marking,
  theme,
  onOpen,
  onMarkRead,
}: {
  notification: AppNotification;
  marking: boolean;
  theme: AppTheme;
  onOpen: (id: string) => void;
  onMarkRead: (id: string) => void;
}) {
  const status = NOTIFICATION_STATUS[notification.status];
  const unread = notification.status !== 'read';
  // Dos Pressable hermanos (no anidados): en web cada uno es un <button> y
  // un botón dentro de otro es HTML inválido.
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${notification.title}. ${status.label}. Abrir detalle`}
        onPress={() => onOpen(notification.id)}
        style={({ pressed }) => [styles.cardContent, pressed && styles.pressed]}>
        <View style={styles.row}>
          <ThemedText style={[styles.title, unread && styles.bold]} numberOfLines={2}>
            {notification.title}
          </ThemedText>
          <View style={[styles.badge, { backgroundColor: status.colors.background }]}>
            <ThemedText style={[styles.badgeText, { color: status.colors.foreground }]}>{status.label}</ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.text, { color: theme.mutedText }]} numberOfLines={2}>
          {notification.body}
        </ThemedText>
        <ThemedText style={[styles.small, { color: theme.mutedText }]}>{formatDateTime(notification.createdAt)}</ThemedText>
      </Pressable>
      {unread ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Marcar como leída"
          accessibilityState={{ disabled: marking, busy: marking }}
          disabled={marking}
          onPress={() => onMarkRead(notification.id)}
          hitSlop={8}
          style={({ pressed }) => [styles.markButton, pressed && styles.pressed]}>
          {marking ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <ThemedText style={[styles.small, styles.bold, { color: theme.primary }]}>Marcar como leída</ThemedText>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

/** Carga, vacío, error o sesión expirada de la lista. */
export function NotificationsEmpty({
  state,
  theme,
  onRetry,
}: {
  state: NotificationsState;
  theme: AppTheme;
  onRetry: () => void;
}) {
  if (!state.ownerId) {
    return <Message theme={theme} icon="account-lock-outline" title="Inicia sesión para ver tus notificaciones." />;
  }
  if (state.loading) {
    return (
      <View style={styles.centered} accessibilityLabel="Cargando notificaciones">
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={[styles.muted, { color: theme.mutedText }]}>Cargando notificaciones…</ThemedText>
      </View>
    );
  }
  if (state.error && !state.loaded) {
    const retry = state.error.kind === 'network';
    return (
      <Message
        theme={theme}
        icon={state.error.kind === 'session' ? 'account-lock-outline' : 'cloud-alert-outline'}
        title="No se pudieron cargar las notificaciones."
        text={state.error.message}
        action={retry ? { label: 'Reintentar', onPress: onRetry } : undefined}
      />
    );
  }
  const title =
    state.filter === 'all'
      ? 'No tienes notificaciones.'
      : `No hay notificaciones ${state.filter === 'read' ? 'leídas' : state.filter === 'sent' ? 'enviadas' : 'pendientes'}.`;
  return <Message theme={theme} icon="bell-outline" title={title} text="Desliza hacia abajo para actualizar." />;
}

export function NotificationDetailView({
  notification,
  marking,
  error,
  theme,
  onMarkRead,
}: {
  notification: AppNotification;
  marking: boolean;
  error: string | null;
  theme: AppTheme;
  onMarkRead: (id: string) => void;
}) {
  const status = NOTIFICATION_STATUS[notification.status];
  return (
    <View style={styles.detail}>
      <View style={[styles.badge, { backgroundColor: status.colors.background }]}>
        <ThemedText style={[styles.badgeText, { color: status.colors.foreground }]}>{status.label}</ThemedText>
      </View>
      <ThemedText accessibilityRole="header" style={styles.detailTitle}>
        {notification.title}
      </ThemedText>
      <ThemedText style={styles.text}>{notification.body}</ThemedText>
      <Info label="Tipo" value={TYPE_LABELS[notification.type] ?? (notification.type || 'General')} theme={theme} />
      <Info label="Recibida" value={formatDateTime(notification.createdAt)} theme={theme} />
      {notification.readAt && <Info label="Leída" value={formatDateTime(notification.readAt)} theme={theme} />}
      {error && (
        <ThemedText accessibilityRole="alert" style={[styles.small, { color: theme.danger }]}>
          {error}
        </ThemedText>
      )}
      {notification.status !== 'read' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Marcar como leída"
          accessibilityState={{ disabled: marking, busy: marking }}
          disabled={marking}
          onPress={() => onMarkRead(notification.id)}
          style={({ pressed }) => [styles.primary, { backgroundColor: marking ? theme.disabled : theme.primary }, pressed && styles.pressed]}>
          <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.bold}>
            {marking ? 'Marcando…' : 'Marcar como leída'}
          </ThemedText>
        </Pressable>
      )}
      <ThemedText style={[styles.small, { color: theme.mutedText }]}>{INTERNAL_NOTICE}</ThemedText>
    </View>
  );
}

function Info({ label, value, theme }: { label: string; value: string; theme: AppTheme }) {
  return (
    <View style={styles.row}>
      <ThemedText style={[styles.small, { color: theme.mutedText }]}>{label}</ThemedText>
      <ThemedText style={[styles.small, styles.bold, styles.infoValue]}>{value}</ThemedText>
    </View>
  );
}

export function Message({
  theme,
  icon,
  title,
  text,
  action,
}: {
  theme: AppTheme;
  icon: 'account-lock-outline' | 'cloud-alert-outline' | 'bell-outline' | 'bell-off-outline';
  title: string;
  text?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.centered}>
      <MaterialCommunityIcons name={icon} size={40} color={theme.icon} />
      <ThemedText style={styles.messageTitle}>{title}</ThemedText>
      {text && <ThemedText style={[styles.muted, { color: theme.mutedText }]}>{text}</ThemedText>}
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={({ pressed }) => [styles.primary, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.bold}>
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
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 6, padding: 14 },
  cardContent: { gap: 6 },
  markButton: { alignSelf: 'flex-end', justifyContent: 'center', minHeight: 32 },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 16, lineHeight: 22 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  text: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  muted: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  centered: { alignItems: 'center', gap: 8, padding: 24 },
  messageTitle: { fontSize: 18, fontWeight: '700', lineHeight: 25, textAlign: 'center' },
  detail: { gap: 12 },
  detailTitle: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  infoValue: { flex: 1, textAlign: 'right' },
  primary: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
  pressed: { opacity: 0.8 },
});
