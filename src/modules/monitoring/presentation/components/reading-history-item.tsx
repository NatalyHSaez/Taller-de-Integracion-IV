import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { type AppTheme, StatusColors } from '@/src/shared/presentation/theme';
import type { ReadingResponse } from '@/src/modules/monitoring/infrastructure/readings-api';

/** Texto y color de cada estado de lectura. No interpreta valores clínicos. */
export const READING_STATUS_BADGES: Record<
  ReadingResponse['status'],
  { label: string; colors: { background: string; foreground: string } }
> = {
  PENDING: { label: 'Pendiente de evaluación', colors: StatusColors.neutral },
  REQUIRES_CONFIRMATION: { label: 'Requiere tu confirmación', colors: StatusColors.warning },
  EVALUATED: { label: 'Evaluada', colors: StatusColors.info },
};

const CONTEXT_LABELS: Record<string, string> = {
  PREPRANDIAL: 'Antes de comer o en ayunas',
  POSTPRANDIAL: 'Después de comer',
};

function formatNumber(value: number) {
  return String(value).replace('.', ',');
}

/** Líneas legibles de una lectura, con las unidades que envía el servidor. */
export function describeReading(reading: ReadingResponse): { title: string; value: string }[] {
  const byCode = new Map(reading.measurements.map((item) => [item.parameterCode, item]));
  const lines: { title: string; value: string }[] = [];
  const unit = (code: string) => {
    const item = byCode.get(code);
    return item?.unit ? ` ${item.unit}` : '';
  };

  const sbp = byCode.get('SBP');
  const dbp = byCode.get('DBP');
  if (sbp && dbp) {
    lines.push({ title: 'Presión arterial', value: `${formatNumber(sbp.value)} / ${formatNumber(dbp.value)}${unit('SBP')}` });
  }
  const labels: Record<string, string> = {
    HEART_RATE: 'Frecuencia cardíaca',
    GLUCOSE: 'Glucosa',
    WEIGHT: 'Peso',
  };
  for (const item of reading.measurements) {
    if ((item.parameterCode === 'SBP' || item.parameterCode === 'DBP') && sbp && dbp) continue;
    lines.push({
      title: labels[item.parameterCode] ?? item.parameterCode,
      value: `${formatNumber(item.value)}${item.unit ? ` ${item.unit}` : ''}`,
    });
  }
  return lines;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export type ReadingHistoryItemProps = {
  reading: ReadingResponse;
  theme: AppTheme;
  /** Recibe el readingId real del servidor. */
  onOpen: (readingId: string) => void;
};

/** Elemento del historial (sin hooks propios: se puede probar renderizándolo). */
export function ReadingHistoryItem({ reading, theme, onOpen }: ReadingHistoryItemProps) {
  const badge = READING_STATUS_BADGES[reading.status] ?? {
    label: 'Registrada',
    colors: StatusColors.neutral,
  };
  const lines = describeReading(reading);
  const context = reading.context ? CONTEXT_LABELS[reading.context] ?? reading.context : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Lectura de las ${formatTime(reading.measuredAt)}. ${lines
        .map((line) => `${line.title}: ${line.value}`)
        .join('. ')}. Estado: ${badge.label}`}
      accessibilityHint="Abre el detalle de esta lectura"
      onPress={() => onOpen(reading.readingId)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.header}>
        <ThemedText style={[styles.time, { color: theme.mutedText }]}>{formatTime(reading.measuredAt)}</ThemedText>
        <View style={[styles.badge, { backgroundColor: badge.colors.background }]}>
          <ThemedText style={[styles.badgeText, { color: badge.colors.foreground }]}>{badge.label}</ThemedText>
        </View>
      </View>

      {lines.map((line) => (
        <View key={line.title} style={styles.line}>
          <ThemedText style={[styles.lineTitle, { color: theme.mutedText }]}>{line.title}</ThemedText>
          <ThemedText style={styles.lineValue}>{line.value}</ThemedText>
        </View>
      ))}

      <View style={styles.footer}>
        {context ? (
          <ThemedText style={[styles.context, { color: theme.mutedText }]}>{context}</ThemedText>
        ) : (
          <View />
        )}
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.icon} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 6, padding: 14 },
  pressed: { opacity: 0.8 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  time: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  line: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  lineTitle: { fontSize: 15, lineHeight: 21 },
  lineValue: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  context: { fontSize: 14, lineHeight: 20 },
});
