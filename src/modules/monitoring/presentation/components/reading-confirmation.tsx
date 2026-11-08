import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import type { AppTheme } from '@/src/shared/presentation/theme';
import type { SubmittedReading } from '@/src/modules/monitoring/application/reading-flow';
import { describeConfirmationReason } from '@/src/modules/monitoring/application/reading-detail';
import type { ConfirmReadingError } from '@/src/modules/monitoring/application/readings';

export type ReadingConfirmationProps = {
  reading: SubmittedReading;
  /** Resumen de los valores ingresados, para revisarlos antes de confirmar. */
  summary: string;
  busy: boolean;
  error: ConfirmReadingError | null;
  theme: AppTheme;
  onConfirm: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  onGoToHistory: () => void;
};

/**
 * Contenido de la confirmación de una lectura inusual.
 * Muestra los motivos tal como los entrega el servicio, sin reinterpretarlos
 * como diagnóstico, y deja la decisión en manos de la persona.
 * (Sin hooks propios: se puede renderizar y recorrer en pruebas.)
 */
export function ReadingConfirmationContent({
  reading,
  summary,
  busy,
  error,
  theme,
  onConfirm,
  onCancel,
  onRefresh,
  onGoToHistory,
}: ReadingConfirmationProps) {
  return (
    <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
          <MaterialCommunityIcons name="clipboard-check-outline" size={28} color={theme.primary} />
        </View>
        <ThemedText accessibilityRole="header" style={styles.title}>
          Confirma esta lectura
        </ThemedText>
        <ThemedText style={[styles.text, { color: theme.mutedText }]}>
          El servicio guardó la lectura, pero necesita que confirmes que los valores
          están bien ingresados antes de evaluarla. Este aviso no es un diagnóstico.
        </ThemedText>

        <View style={[styles.summary, { backgroundColor: theme.surfaceMuted }]}>
          <ThemedText style={[styles.label, { color: theme.mutedText }]}>Valores ingresados</ThemedText>
          <ThemedText style={styles.summaryValue}>{summary}</ThemedText>
        </View>

        <ThemedText style={[styles.label, { color: theme.mutedText }]}>
          Motivos informados por el servicio
        </ThemedText>
        {reading.reasons.length > 0 ? (
          <View accessibilityRole="list" style={styles.reasons}>
            {reading.reasons.map((reason, index) => (
              <View key={`${index}-${reason}`} style={styles.reasonRow}>
                <ThemedText style={[styles.bullet, { color: theme.primary }]}>•</ThemedText>
                <ThemedText style={styles.reason}>{describeConfirmationReason(reason)}</ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText style={[styles.text, { color: theme.mutedText }]}>
            El servicio no informó motivos.
          </ThemedText>
        )}

        {error && (
          <View
            accessibilityRole="alert"
            style={[styles.error, { backgroundColor: theme.dangerBackground, borderColor: theme.dangerBorder }]}>
            <ThemedText style={[styles.text, { color: theme.danger }]}>{error.message}</ThemedText>
            {error.kind === 'not_pending' && (
              <SecondaryButton label="Actualizar estado" onPress={onRefresh} theme={theme} />
            )}
            {error.kind === 'not_found' && (
              <SecondaryButton label="Ir al historial" onPress={onGoToHistory} theme={theme} />
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirmar lectura"
          accessibilityHint="Indica que revisaste los valores y son correctos"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={onConfirm}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: busy ? theme.disabled : theme.primary },
            pressed && styles.pressed,
          ]}>
          {busy ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.primaryText}>
              Sí, los valores son correctos
            </ThemedText>
          )}
        </Pressable>
        <SecondaryButton
          label="Cancelar"
          accessibilityLabel="Cancelar sin confirmar"
          disabled={busy}
          onPress={onCancel}
          theme={theme}
        />
      </View>
    </View>
  );
}

/** Modal de confirmación de lectura inusual. */
export function ReadingConfirmationModal(props: ReadingConfirmationProps & { visible: boolean }) {
  const { visible, ...content } = props;
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={() => {
        if (!content.busy) content.onCancel();
      }}>
      <View style={styles.backdrop}>
        <ReadingConfirmationContent {...content} />
      </View>
    </Modal>
  );
}

export function SecondaryButton({
  label,
  accessibilityLabel,
  onPress,
  theme,
  disabled = false,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  theme: AppTheme;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondary,
        { borderColor: theme.border, opacity: disabled ? 0.5 : 1 },
        pressed && styles.pressed,
      ]}>
      <ThemedText style={[styles.secondaryText, { color: theme.primary }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  body: { gap: 12, padding: 20 },
  icon: { alignItems: 'center', borderRadius: 14, height: 52, justifyContent: 'center', width: 52 },
  title: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  text: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '700', lineHeight: 18, textTransform: 'uppercase' },
  summary: { borderRadius: 12, gap: 4, padding: 12 },
  summaryValue: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  reasons: { gap: 6 },
  reasonRow: { flexDirection: 'row', gap: 8 },
  bullet: { fontSize: 16, lineHeight: 22 },
  reason: { flex: 1, fontSize: 15, lineHeight: 22 },
  error: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 10, padding: 12 },
  actions: { gap: 10, paddingHorizontal: 20 },
  primary: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 52, paddingHorizontal: 16 },
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
