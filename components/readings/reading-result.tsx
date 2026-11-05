import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { AppTheme } from '@/constants/theme';
import type { SubmittedReading } from '@/services/reading-flow';
import { readingStatusLabel } from '@/services/readings';

import { SecondaryButton } from './reading-confirmation';

export type ReadingResultProps = {
  reading: SubmittedReading;
  summary: string;
  /** true si la persona canceló la confirmación de una lectura inusual. */
  unconfirmed: boolean;
  refreshing: boolean;
  refreshError: string | null;
  theme: AppTheme;
  onRefresh: () => void;
  onConfirmNow: () => void;
  onGoToHistory: () => void;
  onNewReading: () => void;
};

/**
 * Resultado del envío. Explica el estado de la lectura (por ejemplo PENDING:
 * evaluación asíncrona) y ofrece ir al historial o actualizar el estado.
 * (Sin hooks propios: se puede renderizar y recorrer en pruebas.)
 */
export function ReadingResult({
  reading,
  summary,
  unconfirmed,
  refreshing,
  refreshError,
  theme,
  onRefresh,
  onConfirmNow,
  onGoToHistory,
  onNewReading,
}: ReadingResultProps) {
  const label = unconfirmed
    ? {
        title: 'Lectura sin confirmar',
        description:
          'La lectura quedó guardada, pero el servicio no la evaluará hasta que confirmes sus valores. Si te equivocaste al ingresarlos, registra una nueva medición.',
      }
    : readingStatusLabel(reading.status);
  const pending = !unconfirmed && reading.status === 'PENDING';

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
        <MaterialCommunityIcons
          name={unconfirmed ? 'clipboard-alert-outline' : pending ? 'progress-clock' : 'check-circle-outline'}
          size={30}
          color={theme.primary}
        />
      </View>
      <ThemedText style={[styles.eyebrow, { color: theme.mutedText }]}>Estado de la lectura</ThemedText>
      <ThemedText accessibilityRole="header" style={styles.title}>
        {label.title}
      </ThemedText>
      <ThemedText style={[styles.summary]}>{summary}</ThemedText>
      <ThemedText style={[styles.text, { color: theme.mutedText }]}>{label.description}</ThemedText>

      {!!refreshError && (
        <ThemedText accessibilityRole="alert" style={[styles.text, { color: theme.danger }]}>
          {refreshError}
        </ThemedText>
      )}

      <View style={styles.actions}>
        {unconfirmed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirmar ahora"
            onPress={onConfirmNow}
            style={({ pressed }) => [styles.primary, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
            <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.primaryText}>
              Revisar y confirmar
            </ThemedText>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Actualizar estado"
            accessibilityState={{ disabled: refreshing, busy: refreshing }}
            disabled={refreshing}
            onPress={onRefresh}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: refreshing ? theme.disabled : theme.primary },
              pressed && styles.pressed,
            ]}>
            {refreshing ? (
              <ActivityIndicator color={theme.onPrimary} />
            ) : (
              <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.primaryText}>
                Actualizar estado
              </ThemedText>
            )}
          </Pressable>
        )}
        <SecondaryButton label="Ir al historial" onPress={onGoToHistory} theme={theme} />
        <SecondaryButton label="Registrar otra medición" onPress={onNewReading} theme={theme} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, gap: 10, padding: 20 },
  icon: { alignItems: 'center', borderRadius: 14, height: 56, justifyContent: 'center', width: 56 },
  eyebrow: { fontSize: 13, fontWeight: '700', lineHeight: 18, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  summary: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  text: { fontSize: 15, lineHeight: 22 },
  actions: { gap: 10, marginTop: 6 },
  primary: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 52, paddingHorizontal: 16 },
  primaryText: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
