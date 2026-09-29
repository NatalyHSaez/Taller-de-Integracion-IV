import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { type Notificacion } from '@/constants/notifications-mock';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getNotifications } from '@/services/notifications';

export default function NotificacionesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(() => {
    return getNotifications().then((data) => {
      setNotificaciones(data);
      setCargando(false);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const onRefresh = useCallback(() => {
    setRefrescando(true);
    cargar().finally(() => setRefrescando(false));
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
            <ThemedText>No tienes notificaciones por ahora.</ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
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