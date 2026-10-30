import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAppState } from '@/hooks/use-app-state';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authSession } from '@/services/auth-session';
import { getApiErrorMessage } from '@/services/errors';
import { notificationsService, type NotificationFilter, type NotificationItem } from '@/services/notifications';

const PAGE_SIZE = 20;
const FILTERS: readonly { key: NotificationFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'sent', label: 'Enviadas' },
  { key: 'read', label: 'Leídas' },
];

function currentScope(): string {
  return `${authSession.generation()}:${authSession.mode() ?? '-'}:${authSession.user()?.id ?? '-'}`;
}

export default function NotificacionesScreen() {
  const router = useRouter();
  const theme = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const { sessionMode, user } = useAppState();
  const scope = `${authSession.generation()}:${sessionMode ?? '-'}:${user?.id ?? '-'}`;
  const [status, setStatus] = useState<NotificationFilter>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const requestRef = useRef(0);
  const busyRef = useRef(false);
  const markingRef = useRef(false);
  const key = `${scope}:${status}`;
  const pendingKey = loadedKey !== key;

  const load = useCallback(async (nextPage = 1, forceRefresh = false) => {
    if (busyRef.current && nextPage !== 1) return;
    const requestId = ++requestRef.current;
    busyRef.current = true;
    if (nextPage === 1) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const result = await notificationsService.list({ page: nextPage, size: PAGE_SIZE,
        status, forceRefresh });
      if (requestId !== requestRef.current) return;
      setItems((previous) => {
        if (nextPage === 1) return result.items;
        const found = new Set(previous.map((item) => item.id));
        return [...previous, ...result.items.filter((item) => !found.has(item.id))];
      });
      setPage(result.page);
      setTotal(result.total);
      setError(null);
    } catch (cause: unknown) {
      if (requestId !== requestRef.current) return;
      setError(getApiErrorMessage(cause, 'No se pudieron consultar las notificaciones.'));
      if (nextPage === 1) { setItems([]); setPage(0); setTotal(0); }
    } finally {
      if (requestId === requestRef.current) {
        busyRef.current = false;
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
        setLoadedKey(key);
      }
    }
  }, [key, status]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(1, true); });
    return () => { active = false; requestRef.current += 1; busyRef.current = false; };
  }, [load]));

  const refresh = useCallback(() => {
    setRefreshing(true);
    setMarkError(null);
    void load(1, true);
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    if (markingRef.current) return;
    markingRef.current = true;
    setMarking(id);
    setMarkError(null);
    try {
      await notificationsService.markRead(id);
      await load(1, true); // Datos y total confirmados por el servidor, no por un Set local.
    } catch (cause: unknown) {
      if (currentScope() === scope) setMarkError(getApiErrorMessage(cause, 'No se pudo marcar como leída.'));
    } finally {
      markingRef.current = false;
      setMarking(null);
    }
  }, [load, scope]);

  const moreAvailable = page > 0 && page * PAGE_SIZE < total;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.filters}>
        {FILTERS.map((filter) => (
          <Pressable key={filter.key} accessibilityRole="button"
            accessibilityState={{ selected: status === filter.key }}
            onPress={() => setStatus(filter.key)}
            style={[styles.filter, { backgroundColor: status === filter.key ? theme.primary : theme.surface,
              borderColor: theme.border }]}>
            <ThemedText style={[styles.filterLabel, { color: status === filter.key ? '#FFFFFF' : theme.text }]}>
              {filter.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      {(loading || pendingKey) ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
          <ThemedText>Cargando notificaciones…</ThemedText>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
          ListHeaderComponent={markError ? <ThemedText accessibilityRole="alert" style={styles.error}>{markError}</ThemedText> : null}
          ListEmptyComponent={
            <View style={styles.center}>
              <ThemedText accessibilityRole={error ? 'alert' : undefined} style={styles.message}>
                {error ?? (sessionMode ? 'No hay notificaciones para este filtro.' : 'Inicia sesión para ver notificaciones.')}
              </ThemedText>
              {error && <Pressable accessibilityRole="button" onPress={refresh} style={styles.retry}>
                <ThemedText style={{ color: theme.primary }}>Reintentar</ThemedText>
              </Pressable>}
            </View>
          }
          ListFooterComponent={moreAvailable && !error ? (
            <Pressable accessibilityRole="button" disabled={loadingMore}
              onPress={() => void load(page + 1)} style={[styles.more, { borderColor: theme.border }]}>
              {loadingMore ? <ActivityIndicator color={theme.primary} /> :
                <ThemedText style={{ color: theme.primary }}>Cargar más ({items.length} de {total})</ThemedText>}
            </Pressable>
          ) : null}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${item.titulo}`}
                onPress={() => router.push({ pathname: '/notificacion/[id]', params: { id: item.id } })}
                style={styles.rowContent}>
                <View style={[styles.dot, { backgroundColor: item.leida ? theme.border : theme.primary }]} />
                <View style={styles.textGroup}>
                  <ThemedText type={item.leida ? 'default' : 'defaultSemiBold'}>{item.titulo}</ThemedText>
                  <ThemedText numberOfLines={2} style={styles.body}>{item.descripcion}</ThemedText>
                  <ThemedText style={styles.meta}>{item.hora} · {item.status === 'read' ? 'Leída' :
                    item.status === 'sent' ? 'Enviada' : 'Pendiente'}</ThemedText>
                </View>
              </Pressable>
              {!item.leida && <Pressable accessibilityRole="button" accessibilityLabel="Marcar notificación como leída"
                disabled={Boolean(marking)} onPress={() => void markRead(item.id)}
                style={[styles.markButton, { backgroundColor: theme.primary }, Boolean(marking) && { opacity: 0.5 }]}>
                <ThemedText style={styles.markText}>{marking === item.id ? 'Guardando…' : 'Marcar como leída'}</ThemedText>
              </Pressable>}
            </View>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, paddingBottom: 12 },
  filter: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  filterLabel: { fontSize: 12, fontWeight: '600' },
  center: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  list: { flexGrow: 1, paddingHorizontal: 12, paddingBottom: 24, gap: 10 },
  row: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  rowContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
  textGroup: { flex: 1, gap: 4 },
  body: { opacity: 0.8, fontSize: 14 },
  meta: { opacity: 0.6, fontSize: 12 },
  markButton: { alignSelf: 'flex-start', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  markText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12 },
  more: { alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 10 },
  retry: { padding: 10 },
  error: { padding: 8 },
  message: { textAlign: 'center' },
});
