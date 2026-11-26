import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { useAppState } from '@/src/core/presentation/session/use-app-state';
import type { AlertsService } from '@/src/modules/evaluation/domain/alert';
import { usePatientAlerts } from '@/src/modules/evaluation/presentation/hooks/use-patient-alerts';
import { AlertDetail } from '@/src/modules/evaluation/presentation/components/alerts-view';
import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';
import { Colors, StatusColors } from '@/src/shared/presentation/theme';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';

const CLINICAL_COLORS: Record<string, { label: string; bg: string; fg: string }> = {
  BAJA: { label: 'Baja', bg: StatusColors.info.background, fg: StatusColors.info.foreground },
  MEDIA: { label: 'Media', bg: StatusColors.warning.background, fg: StatusColors.warning.foreground },
  ALTA: { label: 'Alta', bg: StatusColors.danger.background, fg: StatusColors.danger.foreground },
  MUY_ALTA: { label: 'Muy alta', bg: StatusColors.danger.background, fg: StatusColors.danger.foreground },
};
const FALLBACK_COLOR = { bg: StatusColors.neutral.background, fg: StatusColors.neutral.foreground };

function dateLabel(value: string | null): string {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function PatientAlertsScreen({ service }: { service: AlertsService }) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user, selectedPatient, sessionMode, permissions } = useAppState();

  const patientId = selectedPatient?.id ?? '';
  const noAccess = !patientId || !permissions.alerts;
  const scope = `${sessionMode ?? '-'}:${user?.id ?? '-'}:${patientId}:${permissions.alerts}`;
  const { controller, state } = usePatientAlerts(service, scope, noAccess ? null : patientId);
  const pendingScope = !noAccess && state.patientId !== patientId;
  const filtro = state.filter;
  const items = state.items;
  const cargando = state.loading;
  const refrescando = state.refreshing;
  const marcando = state.marking.length > 0;
  const error = state.error?.message ?? null;
  const errorMarcado = state.markError?.message ?? null;
  const selected = !pendingScope && !noAccess && !error ? controller.selected() : null;
  const onRefresh = () => { void controller.refresh(); };
  const marcarLeida = (id: string) => controller.markRead(id);
  const count = (status: 'OPEN' | 'READ') => status === 'OPEN' ? state.counts?.open : state.counts?.read;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.filters}>
        {(['OPEN', 'READ'] as const).map((status) => (
          <Pressable
            key={status}
            accessibilityRole="button"
            accessibilityLabel={`${status === 'OPEN' ? 'Abiertas' : 'Leídas'}, ${count(status) ?? '–'}`}
            accessibilityState={{ selected: filtro === status }}
            disabled={noAccess || marcando}
            onPress={() => { void controller.setFilter(status); }}
            style={[
              styles.filter,
              { backgroundColor: filtro === status ? theme.primary : theme.surface, borderColor: theme.border },
            ]}>
            <ThemedText style={{ color: filtro === status ? theme.onPrimary : theme.text, fontWeight: '600' }}>
              {status === 'OPEN' ? 'Abiertas' : 'Leídas'} ({pendingScope ? '–' : count(status) ?? '–'})
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {noAccess ? (
        <View style={styles.center}>
          <ThemedText style={styles.emptyText}>
            Selecciona un paciente autorizado para consultar sus alertas.
          </ThemedText>
        </View>
      ) : ((cargando && !refrescando) || pendingScope) ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
          <ThemedText>Consultando alertas…</ThemedText>
        </View>
      ) : (
        <FlatList
          data={error ? [] : items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={items.length === 0 || Boolean(error) ? styles.empty : styles.list}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={theme.primary} />}
          ListHeaderComponent={errorMarcado ? (
            <ThemedText accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{errorMarcado}</ThemedText>
          ) : null}
          ListEmptyComponent={
            <View style={styles.center}>
              <ThemedText accessibilityRole={error ? 'alert' : undefined} style={styles.emptyText}>
                {error ?? (filtro === 'OPEN' ? 'No hay alertas abiertas.' : 'No hay alertas leídas.')}
              </ThemedText>
              {error && (
                <Pressable accessibilityRole="button" onPress={onRefresh}
                  style={[styles.retry, { borderColor: theme.primary }]}>
                  <ThemedText style={{ color: theme.primary }}>Reintentar</ThemedText>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const severity = CLINICAL_COLORS[item.severity.toUpperCase()];
            const color = severity ?? FALLBACK_COLOR;
            const severityLabel = severity?.label ?? `Severidad: ${item.severity}`;
            return (
              <View accessible accessibilityLabel={`Alerta ${severityLabel}. ${item.explanation}`}
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: color.fg }]}>
                <View style={[styles.badge, { backgroundColor: color.bg }]}>
                  <ThemedText style={[styles.badgeText, { color: color.fg }]}>{severityLabel}</ThemedText>
                </View>
                <ThemedText style={styles.body}>{item.explanation}</ThemedText>
                <ThemedText style={styles.meta}>Regla: {item.ruleCode}</ThemedText>
                <ThemedText style={styles.meta}>Generada: {dateLabel(item.createdAt)}</ThemedText>
                <Pressable accessibilityRole="button" accessibilityLabel="Ver detalle de la alerta"
                  onPress={() => controller.open(item.id)} style={[styles.retry, { borderColor: theme.border }]}>
                  <ThemedText style={{ color: theme.primary }}>Ver detalle</ThemedText>
                </Pressable>
                {item.status === 'READ' ? (
                  <ThemedText style={styles.meta}>Leída: {dateLabel(item.readAt)}</ThemedText>
                ) : (
                  <Pressable accessibilityRole="button" accessibilityLabel="Marcar alerta como leída"
                    disabled={Boolean(marcando) || cargando}
                    onPress={() => void marcarLeida(item.id)}
                    style={[styles.markButton, { backgroundColor: theme.primary },
                      (Boolean(marcando) || cargando) && { opacity: 0.55 }]}>
                    <ThemedText style={[styles.markLabel, { color: theme.onPrimary }]}>
                      {state.marking.includes(item.id) ? 'Guardando…' : 'Marcar como leída'}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            );
          }}
        />
      )}

      <ThemedText style={styles.disclaimer}>
        Las alertas provienen de reglas de seguimiento clínico y no sustituyen la evaluación médica.
      </ThemedText>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => controller.close()}>
        <View style={styles.backdrop}>
          {selected && (
            <AlertDetail
              alert={selected}
              marking={state.marking.includes(selected.id)}
              theme={theme}
              onMarkRead={(id) => void marcarLeida(id)}
              onOpenReading={(readingId) => {
                controller.close();
                router.push({ pathname: '/lectura/[readingId]', params: { readingId } });
              }}
              onClose={() => controller.close()}
            />
          )}
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  filters: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  filter: { flex: 1, alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  empty: { flexGrow: 1 },
  emptyText: { textAlign: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  card: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 12, padding: 14, gap: 8 },
  badge: { alignSelf: 'flex-start', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21 },
  meta: { fontSize: 12, opacity: 0.65 },
  markButton: { borderRadius: 10, padding: 12, marginTop: 4, alignItems: 'center' },
  markLabel: { fontWeight: '600' },
  retry: { alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 10, paddingHorizontal: 20 },
  error: { margin: 16 },
  disclaimer: { fontSize: 11, opacity: 0.6, textAlign: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)', flex: 1, justifyContent: 'flex-end', padding: 12 },
});
