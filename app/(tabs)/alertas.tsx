import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { useAppState } from '@/src/core/presentation/session/use-app-state';
import { getApiErrorMessage } from '@/src/core/infrastructure/http/errors';
import type { AlertStatus, PatientAlert } from '@/src/modules/evaluation/domain/alert';
import { backendAlertsService } from '@/src/modules/evaluation/infrastructure/alerts-api';
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

export default function AlertasScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user, selectedPatient, sessionMode, permissions } = useAppState();

  const patientId = selectedPatient?.id ?? '';
  const noAccess = !patientId || !permissions.alerts;
  const scope = `${sessionMode ?? '-'}:${user?.id ?? '-'}:${patientId}:${permissions.alerts}`;
  const service = backendAlertsService;

  const [filtro, setFiltro] = useState<AlertStatus>('OPEN');
  const [abiertas, setAbiertas] = useState<PatientAlert[]>([]);
  const [leidas, setLeidas] = useState<PatientAlert[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorMarcado, setErrorMarcado] = useState<string | null>(null);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const requestId = useRef(0);
  const marking = useRef(false);
  const currentScope = useRef(scope);

  const cargar = useCallback(async () => {
    const id = ++requestId.current;
    setCargando(true);
    setError(null);
    try {
      // En sesión real ambas consultas se realizan al Gateway, sin recurrir a mocks.
      const [open, read] = await Promise.all([
        service.list(patientId, 'OPEN'),
        service.list(patientId, 'READ'),
      ]);
      if (id !== requestId.current || currentScope.current !== scope) return;
      setAbiertas(open);
      setLeidas(read);
    } catch (cause: unknown) {
      if (id !== requestId.current || currentScope.current !== scope) return;
      setAbiertas([]);
      setLeidas([]);
      setError(getApiErrorMessage(cause));
    } finally {
      if (id === requestId.current && currentScope.current === scope) {
        setLoadedScope(scope);
        setCargando(false);
      }
    }
  }, [patientId, scope, service]);

  useEffect(() => {
    currentScope.current = scope;
    let active = true;
    // El borrado del estado se difiere para evitar actualizaciones sincrónicas
    // dentro de un efecto y para permitir cancelar una identidad ya sustituida.
    void Promise.resolve().then(() => {
      if (!active) return;
      setAbiertas([]);
      setLeidas([]);
      setError(null);
      setErrorMarcado(null);
      setSelectedId(null);
      setRefrescando(false);
      if (noAccess) {
        requestId.current += 1;
        setLoadedScope(scope);
        setCargando(false);
      } else {
        void cargar();
      }
    });
    return () => { active = false; requestId.current += 1; };
  }, [cargar, noAccess, scope]);

  const onRefresh = useCallback(() => {
    if (noAccess) return;
    const requestedScope = scope;
    setRefrescando(true);
    setErrorMarcado(null);
    void cargar().finally(() => {
      if (currentScope.current === requestedScope) setRefrescando(false);
    });
  }, [cargar, noAccess, scope]);

  const marcarLeida = useCallback(async (alertId: string) => {
    if (noAccess || marking.current) return;
    const requestedScope = scope;
    marking.current = true;
    setMarcando(alertId);
    setErrorMarcado(null);
    try {
      await service.markRead(patientId, alertId);
      if (currentScope.current !== requestedScope) return;
      // Conserva la conducta de Cristian: refrescar estado y contadores desde la API.
      await cargar();
    } catch (cause: unknown) {
      if (currentScope.current !== requestedScope) return;
      setErrorMarcado(getApiErrorMessage(cause));
      await cargar();
    } finally {
      marking.current = false;
      if (currentScope.current === requestedScope) setMarcando(null);
    }
  }, [cargar, noAccess, patientId, scope, service]);

  const pendingScope = loadedScope !== scope;
  const items = filtro === 'OPEN' ? abiertas : leidas;
  const selected = !pendingScope && !noAccess
    ? [...abiertas, ...leidas].find((alert) => alert.id === selectedId) ?? null
    : null;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.filters}>
        {(['OPEN', 'READ'] as const).map((status) => (
          <Pressable
            key={status}
            accessibilityRole="button"
            accessibilityLabel={`${status === 'OPEN' ? 'Abiertas' : 'Leídas'}, ${status === 'OPEN' ? abiertas.length : leidas.length}`}
            accessibilityState={{ selected: filtro === status }}
            onPress={() => setFiltro(status)}
            style={[
              styles.filter,
              { backgroundColor: filtro === status ? theme.primary : theme.surface, borderColor: theme.border },
            ]}>
            <ThemedText style={{ color: filtro === status ? theme.onPrimary : theme.text, fontWeight: '600' }}>
              {status === 'OPEN' ? 'Abiertas' : 'Leídas'} ({pendingScope ? '–' : status === 'OPEN' ? abiertas.length : leidas.length})
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
      ) : (cargando || pendingScope) ? (
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
                  onPress={() => setSelectedId(item.id)} style={[styles.retry, { borderColor: theme.border }]}>
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

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelectedId(null)}>
        <View style={styles.backdrop}>
          {selected && (
            <AlertDetail
              alert={selected}
              marking={marcando === selected.id}
              theme={theme}
              onMarkRead={(id) => void marcarLeida(id)}
              onOpenReading={(readingId) => {
                setSelectedId(null);
                router.push({ pathname: '/lectura/[readingId]', params: { readingId } });
              }}
              onClose={() => setSelectedId(null)}
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
