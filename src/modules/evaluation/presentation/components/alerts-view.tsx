import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { type AppTheme, BrandColors, StatusColors } from '@/src/shared/presentation/theme';
import type { AlertFilter, PatientAlert } from '@/src/modules/evaluation/domain/alert';
import type { AlertsState } from '@/src/modules/evaluation/application/patient-alerts';

/**
 * Vista de alertas con el mismo lenguaje visual que Seguimiento: cabecera azul
 * con decoraciones, tarjetas blancas con ícono en un recuadro de color y
 * bordes redondeados. Componentes sin hooks: se pueden probar con npm test.
 */

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Tone = { background: string; foreground: string };

/** Severidad tal como la informa el backend (BAJA…MUY_ALTA) o el mock (ADVERTENCIA…). */
const SEVERITY: Record<string, { label: string; colors: Tone; icon: IconName }> = {
  BAJA: { label: 'Severidad baja', colors: StatusColors.info, icon: 'information-outline' },
  MEDIA: { label: 'Severidad media', colors: StatusColors.warning, icon: 'alert-outline' },
  ALTA: { label: 'Severidad alta', colors: StatusColors.danger, icon: 'alert-octagon-outline' },
  MUY_ALTA: { label: 'Severidad muy alta', colors: StatusColors.danger, icon: 'alert-octagon' },
  INFORMATIVA: { label: 'Informativa', colors: StatusColors.info, icon: 'information-outline' },
  ADVERTENCIA: { label: 'Advertencia', colors: StatusColors.warning, icon: 'alert-outline' },
  ALERTA: { label: 'Alerta', colors: StatusColors.danger, icon: 'alert-octagon-outline' },
};

export function severityOf(severity: string) {
  return SEVERITY[severity] ?? { label: severity || 'Sin severidad', colors: StatusColors.neutral, icon: 'bell-outline' as IconName };
}

export const STATUS_LABELS: Record<PatientAlert['status'], string> = {
  OPEN: 'Sin leer',
  READ: 'Leída',
};

const FILTERS: { value: AlertFilter; label: string; icon: IconName; count: (c: NonNullable<AlertsState['counts']>) => number }[] = [
  { value: 'OPEN', label: 'Sin leer', icon: 'bell-ring-outline', count: (c) => c.open },
  { value: 'READ', label: 'Leídas', icon: 'check-all', count: (c) => c.read },
  { value: 'ALL', label: 'Todas', icon: 'format-list-bulleted', count: (c) => c.all },
];

/** Título de la sección de la lista según el filtro elegido. */
export const SECTION_TITLES: Record<AlertFilter, string> = {
  ALL: 'Todas tus alertas',
  OPEN: 'Alertas sin leer',
  READ: 'Alertas leídas',
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/** Fecha corta para las tarjetas: "6 nov 2026, 09:30". */
function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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

/** Cabecera azul, igual que la de Seguimiento, con los contadores que filtran la lista. */
export function AlertsHero({ state, theme, onFilter }: Pick<AlertsViewProps, 'state' | 'theme' | 'onFilter'>) {
  const open = state.counts?.open ?? 0;
  return (
    <View style={styles.hero}>
      <View style={styles.heroDecorationTop} />
      <View style={styles.heroDecorationBottom} />
      <View style={styles.heroTopRow}>
        <View style={styles.heroCopy}>
          <ThemedText lightColor={BrandColors.onPrimaryEyebrow} darkColor={BrandColors.onPrimaryEyebrow} style={styles.eyebrow}>
            ALERTAS DE TU SALUD
          </ThemedText>
          <ThemedText lightColor={BrandColors.onPrimary} darkColor={BrandColors.onPrimary} style={styles.heroTitle}>
            Tus alertas
          </ThemedText>
        </View>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name={open > 0 ? 'bell-ring-outline' : 'bell-check-outline'} size={30} color={BrandColors.onPrimary} />
        </View>
      </View>
      <ThemedText lightColor={BrandColors.onPrimaryMuted} darkColor={BrandColors.onPrimaryMuted} style={styles.heroDescription}>
        {!state.patientId
          ? 'Elige a quién acompañas para ver sus avisos.'
          : open > 0
            ? `Tienes ${open === 1 ? '1 aviso' : `${open} avisos`} por revisar sobre mediciones fuera de rango.`
            : 'Aquí aparecen los avisos cuando una medición sale de los rangos esperados.'}
      </ThemedText>
      {state.patientId && <AlertFilters state={state} theme={theme} onFilter={onFilter} />}
    </View>
  );
}

/** Contadores del backend que también filtran la lista (dentro de la cabecera azul). */
export function AlertFilters({ state, onFilter }: Pick<AlertsViewProps, 'state' | 'theme' | 'onFilter'>) {
  return (
    <View style={styles.filters} accessibilityRole="tablist" accessibilityLabel="Filtrar alertas">
      {FILTERS.map((filter) => {
        const selected = state.filter === filter.value;
        const count = state.counts ? filter.count(state.counts) : null;
        const color = selected ? BrandColors.primary : BrandColors.onPrimary;
        return (
          <Pressable
            key={filter.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${filter.label}${count === null ? '' : `: ${count}`}`}
            onPress={() => onFilter(filter.value)}
            style={({ pressed }) => [styles.filter, selected && styles.filterSelected, pressed && styles.pressed]}>
            <View style={styles.filterTop}>
              <MaterialCommunityIcons name={filter.icon} size={17} color={color} />
              {count !== null && (
                <ThemedText lightColor={color} darkColor={color} style={styles.filterCount}>
                  {count}
                </ThemedText>
              )}
            </View>
            <ThemedText lightColor={color} darkColor={color} style={styles.filterLabel}>
              {filter.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tarjeta de una alerta: tocarla abre el detalle; "Marcar como leída" va aparte (no anidado). */
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
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${severity.label}. ${STATUS_LABELS[alert.status]}. Ver detalle de la alerta`}
        onPress={() => onOpen(alert.id)}
        style={({ pressed }) => [styles.cardBody, pressed && styles.pressed]}>
        <View style={[styles.iconBox, { backgroundColor: severity.colors.background }]}>
          <MaterialCommunityIcons name={severity.icon} size={27} color={severity.colors.foreground} />
        </View>
        <View style={styles.cardCopy}>
          <View style={styles.cardTitleRow}>
            <ThemedText style={styles.cardTitle} numberOfLines={1}>
              {severity.label}
            </ThemedText>
            {open ? (
              <View style={[styles.statusPill, { backgroundColor: theme.primarySoft }]}>
                <View style={[styles.statusDot, { backgroundColor: theme.primary }]} />
                <ThemedText style={[styles.statusText, { color: theme.primary }]}>{STATUS_LABELS.OPEN}</ThemedText>
              </View>
            ) : (
              <ThemedText style={[styles.statusText, { color: theme.mutedText }]}>{STATUS_LABELS.READ}</ThemedText>
            )}
          </View>
          <ThemedText style={[styles.cardText, { color: open ? theme.text : theme.mutedText }]} numberOfLines={3}>
            {alert.explanation || 'El servicio de evaluación no informó una explicación.'}
          </ThemedText>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="clock-outline" size={15} color={theme.mutedText} />
            <ThemedText style={[styles.meta, { color: theme.mutedText }]}>{formatShortDateTime(alert.createdAt)}</ThemedText>
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={theme.primary} style={styles.chevron} />
      </Pressable>
      {open && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Marcar como leída"
          accessibilityState={{ disabled: marking, busy: marking }}
          disabled={marking}
          onPress={() => onMarkRead(alert.id)}
          style={({ pressed }) => [styles.cardFooter, { borderTopColor: theme.border }, pressed && styles.pressed]}>
          {marking ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <MaterialCommunityIcons name="check-circle-outline" size={19} color={theme.primary} />
          )}
          <ThemedText style={[styles.footerText, { color: theme.primary }]}>
            {marking ? 'Marcando…' : 'Marcar como leída'}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/** Estado vacío, carga o error de la lista. */
export function AlertsEmpty({ state, theme, onRetry }: Pick<AlertsViewProps, 'state' | 'theme' | 'onRetry'>) {
  if (!state.patientId) {
    return <Message theme={theme} icon="account-search-outline" title="Selecciona un paciente" text='Elige en "Mis pacientes" a quién acompañas para ver sus alertas.' />;
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
        tone={state.error.kind === 'network' ? undefined : StatusColors.danger}
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
  const title =
    state.filter === 'OPEN'
      ? 'No hay alertas sin leer.'
      : state.filter === 'READ'
        ? 'No hay alertas leídas.'
        : 'No hay alertas por ahora.';
  return (
    <Message
      theme={theme}
      tone={StatusColors.normal}
      icon="bell-check-outline"
      title={title}
      text="Cuando una medición salga de los rangos esperados, el aviso aparecerá aquí. Desliza hacia abajo para actualizar."
    />
  );
}

/** Detalle con los datos ya recibidos en la lista (hoja inferior). */
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
      <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
      <View style={styles.sheetHeader}>
        <View style={[styles.iconBox, { backgroundColor: severity.colors.background }]}>
          <MaterialCommunityIcons name={severity.icon} size={27} color={severity.colors.foreground} />
        </View>
        <View style={styles.cardCopy}>
          <ThemedText accessibilityRole="header" style={styles.sheetTitle}>
            Detalle de la alerta
          </ThemedText>
          <ThemedText style={[styles.statusText, { color: severity.colors.foreground }]}>{severity.label}</ThemedText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
          <MaterialCommunityIcons name="close" size={24} color={theme.mutedText} />
        </Pressable>
      </View>

      <View style={[styles.explanation, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
        <ThemedText style={styles.explanationText}>
          {alert.explanation || 'El servicio de evaluación no informó una explicación.'}
        </ThemedText>
      </View>

      <View style={[styles.infoList, { borderColor: theme.border }]}>
        <Info icon={alert.status === 'OPEN' ? 'bell-ring-outline' : 'check-all'} label="Estado" value={STATUS_LABELS[alert.status]} theme={theme} />
        <Info icon="calendar-clock" label="Generada" value={formatDateTime(alert.createdAt)} theme={theme} />
        {alert.readAt && <Info icon="eye-check-outline" label="Leída" value={formatDateTime(alert.readAt)} theme={theme} />}
        {!!alert.ruleCode && <Info icon="clipboard-check-outline" label="Regla" value={alert.ruleCode} theme={theme} />}
      </View>

      <View style={styles.disclaimerRow}>
        <MaterialCommunityIcons name="information-outline" size={16} color={theme.mutedText} />
        <ThemedText style={[styles.small, styles.flex, { color: theme.mutedText }]}>
          La generó el servicio de evaluación según las reglas configuradas. No reemplaza la indicación de tu equipo de salud.
        </ThemedText>
      </View>

      <View style={styles.sheetActions}>
        {alert.status === 'OPEN' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Marcar como leída"
            accessibilityState={{ disabled: marking, busy: marking }}
            disabled={marking}
            onPress={() => onMarkRead(alert.id)}
            style={({ pressed }) => [styles.primary, { backgroundColor: marking ? theme.disabled : theme.primary }, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="check-circle-outline" size={19} color={theme.onPrimary} />
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
            style={({ pressed }) => [styles.secondary, { borderColor: theme.primary }, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="file-document-outline" size={19} color={theme.primary} />
            <ThemedText style={[styles.buttonText, { color: theme.primary }]}>Ver la lectura</ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Info({ icon, label, value, theme }: { icon: IconName; label: string; value: string; theme: AppTheme }) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={18} color={theme.primary} />
      <ThemedText style={[styles.small, { color: theme.mutedText }]}>{label}</ThemedText>
      <ThemedText style={[styles.small, styles.bold, styles.infoValue]}>{value}</ThemedText>
    </View>
  );
}

function Message({
  theme,
  tone,
  icon,
  title,
  text,
  action,
}: {
  theme: AppTheme;
  tone?: Tone;
  icon: IconName;
  title: string;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  const colors = tone ?? { background: theme.primarySoft, foreground: theme.primary };
  return (
    <View style={[styles.messageCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.messageIcon, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name={icon} size={34} color={colors.foreground} />
      </View>
      <ThemedText style={styles.messageTitle}>{title}</ThemedText>
      <ThemedText style={[styles.muted, { color: theme.mutedText }]}>{text}</ThemedText>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={({ pressed }) => [styles.primary, styles.messageAction, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="refresh" size={19} color={theme.onPrimary} />
          <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.buttonText}>
            {action.label}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Cabecera (mismas medidas que Seguimiento)
  hero: { backgroundColor: BrandColors.primary, borderRadius: 22, overflow: 'hidden', padding: 20, position: 'relative' },
  heroDecorationTop: {
    backgroundColor: BrandColors.heroHighlight, borderRadius: 80, height: 150, opacity: 0.5,
    position: 'absolute', right: -55, top: -65, width: 150,
  },
  heroDecorationBottom: {
    backgroundColor: BrandColors.heroAccent, borderRadius: 65, bottom: -70, height: 130, left: -45,
    opacity: 0.3, position: 'absolute', width: 130,
  },
  heroTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heroCopy: { flex: 1, paddingRight: 12 },
  eyebrow: { fontSize: 13, fontWeight: '700', letterSpacing: 0.7, lineHeight: 18 },
  heroTitle: { fontSize: 27, fontWeight: '800', lineHeight: 33, marginTop: 4 },
  heroIcon: {
    alignItems: 'center', backgroundColor: BrandColors.overlay, borderColor: BrandColors.overlayBorder,
    borderRadius: 30, borderWidth: StyleSheet.hairlineWidth, height: 60, justifyContent: 'center', width: 60,
  },
  heroDescription: { fontSize: 16, lineHeight: 23, marginTop: 14, maxWidth: 320 },
  // Contadores / filtros dentro de la cabecera
  filters: { flexDirection: 'row', gap: 8, marginTop: 20 },
  filter: {
    backgroundColor: BrandColors.overlaySubtle, borderColor: BrandColors.overlay, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, flex: 1, gap: 2, minHeight: 58, paddingHorizontal: 10, paddingVertical: 8,
  },
  filterSelected: { backgroundColor: BrandColors.onPrimary, borderColor: BrandColors.onPrimary },
  filterTop: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  filterCount: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  filterLabel: { fontSize: 13, fontWeight: '600', lineHeight: 17 },
  // Tarjeta de alerta (mismo estilo que las acciones de Seguimiento)
  card: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
    shadowColor: BrandColors.shadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 2,
  },
  cardBody: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, padding: 14 },
  iconBox: { alignItems: 'center', borderRadius: 12, height: 54, justifyContent: 'center', width: 54 },
  cardCopy: { flex: 1, gap: 4 },
  cardTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  cardTitle: { flexShrink: 1, fontSize: 17, fontWeight: '700', lineHeight: 23 },
  statusPill: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 3 },
  statusDot: { borderRadius: 4, height: 7, width: 7 },
  statusText: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  cardText: { fontSize: 15, lineHeight: 21 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 2 },
  meta: { fontSize: 13, lineHeight: 18 },
  chevron: { alignSelf: 'center' },
  cardFooter: {
    alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 6,
    justifyContent: 'center', minHeight: 46,
  },
  footerText: { fontSize: 15, fontWeight: '700' },
  // Mensajes (vacío, error)
  centered: { alignItems: 'center', gap: 10, padding: 32 },
  messageCard: { alignItems: 'center', borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, gap: 8, padding: 24 },
  messageIcon: { alignItems: 'center', borderRadius: 36, height: 72, justifyContent: 'center', marginBottom: 4, width: 72 },
  messageTitle: { fontSize: 18, fontWeight: '700', lineHeight: 25, textAlign: 'center' },
  messageAction: { alignSelf: 'stretch', marginTop: 8 },
  muted: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  // Hoja de detalle
  sheet: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, gap: 14, padding: 20, paddingTop: 10 },
  sheetHandle: { alignSelf: 'center', borderRadius: 3, height: 5, width: 44 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  explanation: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  explanationText: { fontSize: 16, lineHeight: 23 },
  infoList: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 12, padding: 14 },
  infoRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  infoValue: { flex: 1, textAlign: 'right' },
  disclaimerRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 6 },
  sheetActions: { gap: 10 },
  // Comunes
  small: { fontSize: 13, lineHeight: 18 },
  bold: { fontWeight: '700' },
  flex: { flex: 1 },
  primary: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 50, paddingHorizontal: 16 },
  secondary: {
    alignItems: 'center', borderRadius: 12, borderWidth: 1.5, flexDirection: 'row', gap: 8,
    justifyContent: 'center', minHeight: 50, paddingHorizontal: 16,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
