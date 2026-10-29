import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { type Notificacion } from '@/constants/notifications-mock';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getApiErrorMessage } from '@/services/errors';
import { getNotifications } from '@/services/notifications';

export default function NotificacionesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const cargar = useCallback(async (forceRefresh = false) => {
    const current = ++requestId.current;
    setError(null);
    try {
      const data = await getNotifications(forceRefresh);
      if (current === requestId.current) setNotificaciones(data);
    } catch (cause) {
      if (current === requestId.current) {
        setNotificaciones([]);
        setError(getApiErrorMessage(cause, 'No fue posible cargar las notificaciones.'));
      }
    } finally {
      if (current === requestId.current) {
        setCargando(false);
        setRefrescando(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      void cargar(true);
      return () => { requestId.current += 1; };
    }, [cargar])
  );

  const onRefresh = useCallback(() => {
    setRefrescando(true);
    void cargar(true);
  }, [cargar]);

  if (cargando) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={notificaciones}
        keyExtractor={(item) => item.id}
        contentContainerStyle={notificaciones.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContent}>
            <ThemedText type="title">Notificaciones</ThemedText>
            <ThemedText accessibilityRole={error ? 'alert' : undefined}>
              {error ?? 'No tienes notificaciones por ahora.'}
            </ThemedText>
            {error ? (
              <Pressable accessibilityRole="button" onPress={onRefresh} disabled={refrescando}>
                <ThemedText style={{ color: theme.primary }}>Reintentar</ThemedText>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.titulo}. ${item.leida ? 'Leída' : 'No leída'}. ${item.hora}.`}
            accessibilityHint="Toca para ver el detalle"
            style={[styles.row, { borderBottomColor: theme.border }]}
            onPress={() =>
              router.push({ pathname: '/notificacion/[id]', params: { id: item.id } })
            }>
            <View style={[styles.dot, !item.leida && { backgroundColor: theme.primary }]} />
            <View style={styles.textGroup}>
              <ThemedText type={item.leida ? 'default' : 'defaultSemiBold'}>{item.titulo}</ThemedText>
              <ThemedText style={styles.descripcion}>{item.descripcion}</ThemedText>
              <ThemedText style={styles.hora}>{item.hora}</ThemedText>
            </View>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  emptyList: { flexGrow: 1 },
  emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  list: { padding: 16 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  textGroup: { flex: 1, gap: 2 },
  descripcion: { opacity: 0.8 },
  hora: { fontSize: 12, opacity: 0.5 },
});