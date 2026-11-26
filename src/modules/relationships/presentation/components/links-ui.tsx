import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type ComponentProps, type PropsWithChildren, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { LinkCodeCountdown } from '@/src/modules/relationships/presentation/components/link-code-countdown';
import { PERMISSION_LABELS } from '@/src/modules/relationships/presentation/link-format';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';
import { AccentColors, type AppTheme, BrandColors, Colors, StatusColors } from '@/src/shared/presentation/theme';

/**
 * Piezas visuales de la pantalla Vínculos, con el mismo lenguaje que
 * Seguimiento: cabecera azul, tarjetas blancas con borde fino y sombra suave,
 * íconos en recuadros de color. Solo dibujan; la lógica vive en la pantalla.
 */

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type LinkRole = 'caregiver' | 'doctor';

export function useLinksTheme() {
  const dark = useColorScheme() === 'dark';
  return { theme: Colors[dark ? 'dark' : 'light'], accent: AccentColors[dark ? 'dark' : 'light'] };
}

function roleTone(role: LinkRole, theme: AppTheme, accent: ReturnType<typeof useLinksTheme>['accent']) {
  return role === 'doctor'
    ? { background: accent.purpleSoft, foreground: accent.purple }
    : { background: theme.primarySoft, foreground: theme.primary };
}

export const PERMISSION_ICONS: Record<string, IconName> = {
  PATIENT_PROFILE_VIEW: 'card-account-details-outline',
  MEASUREMENT_CREATE: 'pencil-plus-outline',
  MEASUREMENT_VIEW: 'chart-line',
  ALERT_VIEW: 'bell-alert-outline',
};

export function initialsOf(name: string | null | undefined): string {
  return (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

/* ---------- Cabecera ---------- */

export function LinksHero({
  subtitle,
  stats,
  onRefresh,
  refreshing,
  refreshDisabled,
}: {
  subtitle: string;
  stats?: { icon: IconName; label: string }[];
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshDisabled?: boolean;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroDecorationTop} />
      <View style={styles.heroDecorationBottom} />
      {!!onRefresh && (
        <View style={styles.heroTopRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Actualizar vínculos"
            accessibilityState={{ busy: !!refreshing, disabled: !!refreshDisabled }}
            disabled={refreshDisabled}
            onPress={onRefresh}
            hitSlop={8}
            style={({ pressed }) => [styles.heroChip, pressed && styles.pressed, refreshDisabled && styles.dimmed]}>
            {refreshing ? (
              <ActivityIndicator size="small" color={BrandColors.onPrimary} />
            ) : (
              <MaterialCommunityIcons name="refresh" size={18} color={BrandColors.onPrimary} />
            )}
            <Text style={styles.heroChipText}>{refreshing ? 'Actualizando…' : 'Actualizar'}</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.heroCopy}>
        <Text style={styles.eyebrow}>TU RED DE APOYO</Text>
        <Text accessibilityRole="header" style={styles.heroTitle}>
          Vínculos
        </Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </View>
      {!!stats?.length && (
        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <MaterialCommunityIcons name={stat.icon} size={18} color={BrandColors.onPrimary} />
              <Text style={styles.statText}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ---------- Estructura ---------- */

export function SectionHeader({ title, count }: { title: string; count?: number }) {
  const { theme } = useLinksTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>
        {title}
      </Text>
      {count !== undefined && (
        <View style={[styles.countPill, { backgroundColor: theme.primarySoft }]}>
          <Text style={[styles.countText, { color: theme.primary }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}

export function Panel({ children }: PropsWithChildren) {
  const { theme } = useLinksTheme();
  return <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>;
}

export function Paragraph({ children, muted }: PropsWithChildren<{ muted?: boolean }>) {
  const { theme } = useLinksTheme();
  return <Text selectable style={[styles.paragraph, { color: muted ? theme.mutedText : theme.text }]}>{children}</Text>;
}

export function Divider() {
  const { theme } = useLinksTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

/** Cabecera de una tarjeta: ícono en recuadro de color, título y descripción. */
export function PanelHeader({ icon, title, description, role = 'caregiver' }: {
  icon: IconName;
  title: string;
  description?: string;
  role?: LinkRole;
}) {
  const { theme, accent } = useLinksTheme();
  const tone = roleTone(role, theme, accent);
  return (
    <View style={styles.panelHeader}>
      <View style={[styles.iconBox, { backgroundColor: tone.background }]}>
        <MaterialCommunityIcons name={icon} size={26} color={tone.foreground} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.panelTitle, { color: theme.text }]}>{title}</Text>
        {!!description && <Text style={[styles.panelDescription, { color: theme.mutedText }]}>{description}</Text>}
      </View>
    </View>
  );
}

/* ---------- Personas vinculadas ---------- */

export function PersonHeader({ name, email, role, badge }: {
  name: string;
  email?: string;
  role: LinkRole;
  badge?: { label: string; tone: 'pending' | 'approved' };
}) {
  const { theme, accent } = useLinksTheme();
  const tone = roleTone(role, theme, accent);
  const initials = initialsOf(name);
  const badgeTone = badge?.tone === 'pending' ? StatusColors.warning : StatusColors.normal;
  return (
    <View style={styles.personHeader}>
      <View style={[styles.avatar, { backgroundColor: tone.background }]}>
        {initials ? (
          <Text style={[styles.avatarText, { color: tone.foreground }]}>{initials}</Text>
        ) : (
          <MaterialCommunityIcons name={role === 'doctor' ? 'stethoscope' : 'account-heart-outline'} size={24} color={tone.foreground} />
        )}
      </View>
      <View style={styles.flex}>
        <Text selectable style={[styles.personName, { color: theme.text }]} numberOfLines={2}>
          {name}
        </Text>
        {!!email && (
          <Text selectable style={[styles.metaText, { color: theme.mutedText }]} numberOfLines={1}>
            {email}
          </Text>
        )}
        <View style={styles.badges}>
          <View style={[styles.rolePill, { backgroundColor: tone.background }]}>
            <MaterialCommunityIcons name={role === 'doctor' ? 'stethoscope' : 'account-heart-outline'} size={13} color={tone.foreground} />
            <Text style={[styles.rolePillText, { color: tone.foreground }]}>{role === 'doctor' ? 'Médico' : 'Cuidador'}</Text>
          </View>
          {!!badge && (
            <View style={[styles.rolePill, { backgroundColor: badgeTone.background }]}>
              <Text style={[styles.rolePillText, { color: badgeTone.foreground }]}>{badge.label}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export function MetaRow({ icon, children }: PropsWithChildren<{ icon: IconName }>) {
  const { theme } = useLinksTheme();
  return (
    <View style={styles.metaRow}>
      <MaterialCommunityIcons name={icon} size={16} color={theme.mutedText} />
      <Text selectable style={[styles.metaText, { color: theme.mutedText }]}>
        {children}
      </Text>
    </View>
  );
}

export function PermissionToggle({ icon, label, value, disabled, onChange }: {
  icon: IconName;
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const { theme } = useLinksTheme();
  return (
    <View style={styles.permissionRow}>
      <View style={[styles.smallIconBox, { backgroundColor: value ? theme.primarySoft : theme.surfaceMuted }]}>
        <MaterialCommunityIcons name={icon} size={18} color={value ? theme.primary : theme.mutedText} />
      </View>
      <Text style={[styles.permissionLabel, { color: theme.text }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        value={value}
        onValueChange={onChange}
        thumbColor={BrandColors.onPrimary}
        {...({ activeThumbColor: BrandColors.onPrimary } as object)}
        trackColor={{ true: theme.primary, false: theme.border }}
      />
    </View>
  );
}

/** Permisos concedidos como etiquetas (solo lectura). */
export function PermissionChips({ codes }: { codes: readonly string[] }) {
  const { theme } = useLinksTheme();
  if (!codes.length) return <MetaRow icon="lock-outline">Sin permisos concedidos.</MetaRow>;
  return (
    <View style={styles.chips}>
      {codes.map((code) => (
        <View key={code} style={[styles.chip, { backgroundColor: theme.primarySoft }]}>
          <MaterialCommunityIcons name={PERMISSION_ICONS[code] ?? 'check'} size={14} color={theme.primary} />
          <Text style={[styles.chipText, { color: theme.primary }]}>{PERMISSION_LABELS[code] ?? code}</Text>
        </View>
      ))}
    </View>
  );
}

/* ---------- Botones y mensajes ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function LinkButton({ label, onPress, icon, variant = 'primary', disabled, busy, accessibilityLabel }: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
}) {
  const { theme } = useLinksTheme();
  const palette = {
    primary: { background: theme.primary, border: theme.primary, foreground: theme.onPrimary },
    secondary: { background: theme.surface, border: theme.border, foreground: theme.primary },
    danger: { background: theme.surface, border: theme.dangerBorder, foreground: theme.danger },
  }[variant];
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background, borderColor: palette.border },
        pressed && styles.pressed,
        inactive && styles.dimmed,
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={palette.foreground} />
      ) : (
        !!icon && <MaterialCommunityIcons name={icon} size={19} color={palette.foreground} />
      )}
      <Text style={[styles.buttonText, { color: palette.foreground }]}>{label}</Text>
    </Pressable>
  );
}

export function Notice({ tone, text, action }: {
  tone: 'error' | 'success' | 'info';
  text: string;
  action?: ReactNode;
}) {
  const colors = { error: StatusColors.danger, success: StatusColors.normal, info: StatusColors.info }[tone];
  const icon: IconName = { error: 'alert-circle-outline', success: 'check-circle-outline', info: 'information-outline' }[tone] as IconName;
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[styles.notice, { backgroundColor: colors.background }]}>
      <View style={styles.noticeRow}>
        <MaterialCommunityIcons name={icon} size={19} color={colors.foreground} />
        <Text selectable style={[styles.noticeText, { color: colors.foreground }]}>{text}</Text>
      </View>
      {action}
    </View>
  );
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const { theme } = useLinksTheme();
  return (
    <View style={[styles.empty, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
        <MaterialCommunityIcons name={icon} size={26} color={theme.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: theme.mutedText }]}>{text}</Text>
    </View>
  );
}

export function Loading({ text }: { text: string }) {
  const { theme } = useLinksTheme();
  return (
    <View style={[styles.panel, styles.loading, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <ActivityIndicator color={theme.primary} />
      <Text style={[styles.metaText, { color: theme.mutedText }]}>{text}</Text>
    </View>
  );
}

/* ---------- Código de vinculación ---------- */

/** Código grande, cuenta regresiva, QR (contiene solo el código) y botón para compartirlo. */
export function LinkCodeDisplay({ code, expiresAt, onExpired, qrHint, shareMessage, onShareError }: {
  code: string;
  expiresAt: string;
  onExpired: () => void;
  qrHint: string;
  shareMessage: string;
  onShareError: () => void;
}) {
  const { theme } = useLinksTheme();
  const [showQr, setShowQr] = useState(false);
  return (
    <View style={styles.codeBlock}>
      <View style={[styles.codeBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
        <Text style={[styles.codeLabel, { color: theme.mutedText }]}>CÓDIGO DE VINCULACIÓN</Text>
        <Text selectable accessibilityLabel={`Código ${code.split('').join(' ')}`} style={[styles.code, { color: theme.text }]}>
          {code}
        </Text>
        <View style={styles.codeMeta}>
          <MaterialCommunityIcons name="timer-sand" size={16} color={StatusColors.warning.foreground} />
          <LinkCodeCountdown expiresAt={expiresAt} onExpired={onExpired} />
        </View>
        <Text style={[styles.metaText, { color: theme.mutedText }]}>
          Vence a las {new Date(expiresAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      {showQr && (
        <View style={styles.qrWrap}>
          <View style={styles.qrFrame}>
            <QRCode value={code} size={200} />
          </View>
          <Text style={[styles.metaText, styles.center, { color: theme.mutedText }]}>{qrHint}</Text>
        </View>
      )}
      <View style={styles.buttonRow}>
        <View style={styles.flex}>
          <LinkButton
            variant="secondary"
            icon={showQr ? 'eye-off-outline' : 'qrcode'}
            label={showQr ? 'Ocultar QR' : 'Ver QR'}
            accessibilityLabel={showQr ? 'Ocultar QR' : 'Mostrar QR escaneable'}
            onPress={() => setShowQr((value) => !value)}
          />
        </View>
        <View style={styles.flex}>
          <LinkButton
            icon="share-variant-outline"
            label="Compartir"
            accessibilityLabel="Compartir código"
            onPress={() => {
              void Share.share({ message: shareMessage }).catch(onShareError);
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.78 },
  dimmed: { opacity: 0.55 },
  // Cabecera
  hero: { backgroundColor: BrandColors.primary, borderRadius: 22, gap: 14, overflow: 'hidden', padding: 20, position: 'relative' },
  heroDecorationTop: {
    backgroundColor: BrandColors.heroHighlight, borderRadius: 80, height: 150, opacity: 0.5,
    position: 'absolute', right: -55, top: -65, width: 150,
  },
  heroDecorationBottom: {
    backgroundColor: BrandColors.heroAccent, borderRadius: 65, bottom: -70, height: 130, left: -45,
    opacity: 0.3, position: 'absolute', width: 130,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  heroChip: {
    alignItems: 'center', backgroundColor: BrandColors.overlay, borderColor: BrandColors.overlayBorder,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 6, minHeight: 36,
    paddingHorizontal: 12,
  },
  heroChipText: { color: BrandColors.onPrimary, fontSize: 14, fontWeight: '700' },
  heroCopy: { gap: 4 },
  eyebrow: { color: BrandColors.onPrimaryEyebrow, fontSize: 13, fontWeight: '700', letterSpacing: 0.7, lineHeight: 18 },
  heroTitle: { color: BrandColors.onPrimary, fontSize: 27, fontWeight: '800', lineHeight: 33 },
  heroSubtitle: { color: BrandColors.onPrimaryMuted, fontSize: 15, lineHeight: 21 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    alignItems: 'center', backgroundColor: BrandColors.overlaySubtle, borderColor: BrandColors.overlay,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  statText: { color: BrandColors.onPrimary, fontSize: 14, fontWeight: '700' },
  // Estructura
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  countPill: { borderRadius: 999, minWidth: 26, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  panel: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, gap: 14, padding: 16,
    shadowColor: BrandColors.shadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 2,
  },
  paragraph: { fontSize: 15, lineHeight: 22 },
  divider: { height: StyleSheet.hairlineWidth },
  panelHeader: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  iconBox: { alignItems: 'center', borderRadius: 12, height: 50, justifyContent: 'center', width: 50 },
  panelTitle: { fontSize: 17, fontWeight: '700', lineHeight: 23 },
  panelDescription: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  // Personas
  personHeader: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  avatar: { alignItems: 'center', borderRadius: 26, height: 52, justifyContent: 'center', width: 52 },
  avatarText: { fontSize: 18, fontWeight: '800' },
  personName: { fontSize: 17, fontWeight: '700', lineHeight: 23 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  rolePill: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: 4, paddingHorizontal: 9, paddingVertical: 3 },
  rolePillText: { fontSize: 12, fontWeight: '700' },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  metaText: { fontSize: 13, lineHeight: 18 },
  permissionRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 40 },
  smallIconBox: { alignItems: 'center', borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  permissionLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 13, fontWeight: '600' },
  // Botones y mensajes
  button: {
    alignItems: 'center', borderRadius: 12, borderWidth: 1.5, flexDirection: 'row', gap: 8,
    justifyContent: 'center', minHeight: 48, paddingHorizontal: 14,
  },
  buttonText: { fontSize: 15, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  notice: { borderRadius: 12, gap: 10, padding: 12 },
  noticeRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  noticeText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  empty: { alignItems: 'center', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, gap: 6, padding: 20 },
  emptyIcon: { alignItems: 'center', borderRadius: 26, height: 52, justifyContent: 'center', marginBottom: 4, width: 52 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  loading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  // Código
  codeBlock: { gap: 12 },
  codeBox: { alignItems: 'center', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 6, paddingHorizontal: 12, paddingVertical: 16 },
  codeLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.7 },
  code: { fontFamily: 'monospace', fontSize: 34, fontWeight: '800', letterSpacing: 6 },
  codeMeta: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  qrWrap: { alignItems: 'center', gap: 8 },
  qrFrame: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14 },
});
