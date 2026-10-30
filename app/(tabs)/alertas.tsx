import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StatusColors, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppState } from '@/hooks/use-app-state';
import { alertsService, type AlertStatus } from '@/services/alerts';
import { getApiErrorMessage } from '@/services/errors';
import type { AlertResponse } from '@/types/api';

const CLINICAL_COLORS: Record<string, { label: string; bg: string; fg: string }> = {
  BAJA: { label: 'Baja', bg: StatusColors.info.background, fg: StatusColors.info.foreground },
  MEDIA: { label: 'Media', bg: StatusColors.warning.background, fg: StatusColors.warning.foreground },
  ALTA: { label: 'Alta', bg: StatusColors.danger.background, fg: StatusColors.danger.foreground },
  MUY_ALTA: { label: 'Muy alta', bg: StatusColors.danger.background, fg: StatusColors.danger.foreground },
};
const FALLBACK_COLOR = { bg: StatusColors.neutral.background, fg: StatusColors.neutral.foreground };

function dateLabel(date: string | null): string {
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
}

export default function AlertasScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user, selectedPatient, sessionMode, permissions } = useAppState();
  const patientId = selectedPatient?.id ?? '';
  const scope = `${sessionMode ?? '-'}:${user?.id ?? '-'}:${patientId}:${permissions.alerts}`;
  const [filtro, setFiltro] = useState<AlertStatus>('OPEN');
  const [abiertas, setAbiertas] = useState<AlertResponse[]>([]);
  const [leidas, setLeidas] = useState<AlertResponse[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorMarcado, setErrorMarcado] = useState<string | null>(null);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const requestId = useRef(0);
  const marking = useRef(false);

  const cargar = useCallback(async (forceRefresh = false) => {
    const id = ++requestId.current;
    setCargando(true);
    setError(null);
    try {
      const [open, read] = await Promise.all([
        alertsService.list(patientId, 'OPEN', forceRefresh),
        alertsService.list(patientId, 'READ', forceRefresh),
      ]);
      if (id !== requestId.current) return;
      setAbiertas(open);
      setLeidas(read);
      setError(null);
    } catch (cause: unknown) {
      if (id !== requestId.current) return;
      setAbiertas([]);
      setLeidas([]);
      setError(getApiErrorMessage(cause));
    } finally {
      if (id === requestId.current) {
        setLoadedScope(scope);
        setCargando(false);
      }
    }
  }, [patientId, scope]);

  useEffect(() => {
    let active = true;
    const current = requestId;
    void Promise.resolve().then(() => { if (active) return cargar(); });
    return () => { active = false; current.current += 1; };
  }, [cargar]);

  const onRefresh = useCallback(() => {
    setRefrescando(true);
    setErrorMarcado(null);
    void cargar(true).finally(() => setRefrescando(false));
  }, [cargar]);

  const marcarLeida = useCallback(async (alertId: string) => {
    if (marking.current) return;
    marking.current = true;
    setMarcando(alertId);
    setErrorMarcado(null);
    try {
      await alertsService.markRead(patientId, alertId);
      await cargar(true); // La lista y los contadores se obtienen otra vez del servidor.
    } catch (cause: unknown) {
      setErrorMarcado(getApiErrorMessage(cause));
      // Si la alerta dejó de existir, recuperar la lista en vez de marcarla localmente.
      await cargar(true);
    } finally {
      marking.current = false;
      setMarcando(null);
    }
  }, [cargar, patientId]);

  const pendingScope = loadedScope !== scope;
  const items = filtro === 'OPEN' ? abiertas : leidas;
  const noAccess = !patientId || !permissions.alerts;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.filters}>
        {(['OPEN', 'READ'] as const).map((status) => (
          <Pressable key={status} accessibilityRole="button"
            accessibilityLabel={`${status === 'OPEN' ? 'Abiertas' : 'Leídas'}, ${status === 'OPEN' ? abiertas.length : leidas.length}`}
            accessibilityState={{ selected: filtro === status }}
            onPress={() => setFiltro(status)}
            style={[styles.filter, { backgroundColor: filtro === status ? theme.primary : theme.surface,
              borderColor: theme.border }]}>
            <ThemedText style={{ color: filtro === status ? '#FFFFFF' : theme.text, fontWeight: '600' }}>
              {status === 'OPEN' ? 'Abiertas' : 'Leídas'} ({pendingScope ? '–' : status === 'OPEN' ? abiertas.length : leidas.length})
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {(cargando || pendingScope) ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} />
          <ThemedText>Consultando alertas…</ThemedText></View>
      ) : (
        <FlatList
          data={error ? [] : items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={items.length === 0 || Boolean(error) ? styles.empty : styles.list}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={theme.primary} />}
          ListHeaderComponent={errorMarcado ? (
            <ThemedText accessibilityRole="alert" style={styles.error}>{errorMarcado}</ThemedText>
          ) : null}
          ListEmptyComponent={
            <View style={styles.center}>
              <ThemedText accessibilityRole={error ? 'alert' : undefined} style={styles.emptyText}>
                {error ?? (noAccess ? 'Selecciona un paciente autorizado para consultar alertas.' :
                  filtro === 'OPEN' ? 'No hay alertas abiertas.' : 'No hay alertas leídas.')}
              </ThemedText>
              {error && <Pressable accessibilityRole="button" onPress={onRefresh}
                style={[styles.retry, { borderColor: theme.primary }]}>
                <ThemedText style={{ color: theme.primary }}>Reintentar</ThemedText>
              </Pressable>}
            </View>
          }
          renderItem={({ item }) => {
            const severity = CLINICAL_COLORS[item.severity.toUpperCase()];
            const color = severity ?? FALLBACK_COLOR;
            const severityLabel = severity?.label ?? `Severidad: ${item.severity}`;
            return (
              <View accessible accessibilityLabel={`Alerta ${severityLabel}. ${item.explanation}`}
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border,
                  borderLeftColor: color.fg }]}>
                <View style={[styles.badge, { backgroundColor: color.bg }]}>
                  <ThemedText style={[styles.badgeText, { color: color.fg }]}>{severityLabel}</ThemedText>
                </View>
                <ThemedText style={styles.body}>{item.explanation}</ThemedText>
                <ThemedText style={styles.meta}>Regla: {item.ruleCode}</ThemedText>
                <ThemedText style={styles.meta}>Generada: {dateLabel(item.createdAt)}</ThemedText>
                {item.status === 'READ' ? (
                  <ThemedText style={styles.meta}>Leída: {dateLabel(item.readAt)}</ThemedText>
                ) : (
                  <Pressable accessibilityRole="button" accessibilityLabel="Marcar alerta como leída"
                    disabled={Boolean(marcando) || cargando}
                    onPress={() => void marcarLeida(item.id)}
                    style={[styles.markButton, { backgroundColor: theme.primary },
                      (Boolean(marcando) || cargando) && { opacity: 0.55 }]}>
                    <ThemedText style={styles.markLabel}>
                      {marcando === item.id ? 'Guardando…' : 'Marcar como leída'}
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
  markLabel: { color: '#FFFFFF', fontWeight: '600' },
  retry: { borderWidth: 1, borderRadius: 10, padding: 10, paddingHorizontal: 20 },
  error: { margin: 16 },
  disclaimer: { fontSize: 11, opacity: 0.6, textAlign: 'center', paddingVertical: 12, paddingHorizontal: 20 },
});
