import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { type Notificacion } from '@/constants/notifications-mock';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getNotificationById, markNotificationRead } from '@/services/notifications';

export default function NotificacionDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme === 'dark' ? 'dark' : 'light'].tint;
  const [notificacion, setNotificacion] = useState<Notificacion | undefined>();
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    getNotificationById(id).then((data) => {
      setNotificacion(data);
      setCargando(false);
      // Se marca como leída al abrirla; al volver, la lista se refresca sola.
      markNotificationRead(id);
    });
  }, [id]);

  if (cargando) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator color={tint} />
      </ThemedView>
    );
  }

  if (!notificacion) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>No se encontró esta notificación.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{notificacion.titulo}</ThemedText>
      <ThemedText style={styles.hora}>{notificacion.hora}</ThemedText>
      <ThemedText style={styles.descripcion}>{notificacion.descripcion}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 10 },
  hora: { fontSize: 12, opacity: 0.6 },
  descripcion: { fontSize: 15, lineHeight: 22, marginTop: 8 },
});