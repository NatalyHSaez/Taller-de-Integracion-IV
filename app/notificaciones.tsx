import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { type Notificacion } from '@/constants/notifications-mock';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getNotifications, markNotificationRead } from '@/services/notifications';

export default function NotificacionesScreen() {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme === 'dark' ? 'dark' : 'light'].tint;
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getNotifications().then((data) => {
      setNotificaciones(data);
      setCargando(false);
    });
  }, []);

  const marcarComoLeida = (id: string) => {
    setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
    markNotificationRead(id); // no bloquea la UI mientras responde
  };

  if (cargando) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <ActivityIndicator color={tint} />
      </ThemedView>
    );
  }

  if (notificaciones.length === 0) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <ThemedText type="title">Notificaciones</ThemedText>
        <ThemedText>No tienes notificaciones por ahora.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={notificaciones}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => marcarComoLeida(item.id)}>
            <View style={[styles.dot, { backgroundColor: item.leida ? 'transparent' : tint }]} />
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
  list: { padding: 16 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ccc' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  textGroup: { flex: 1, gap: 2 },
  descripcion: { opacity: 0.8 },
  hora: { fontSize: 12, opacity: 0.5 },
});