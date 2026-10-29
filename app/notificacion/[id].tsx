import { useLocalSearchParams, useRouter } from 'expo-router';
import { Action } from '@/components/flow-ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { type Notificacion } from '@/constants/notifications-mock';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getApiErrorMessage } from '@/services/errors';
import { authSession } from '@/services/auth-session';
import { getNotificationById, markNotificationRead } from '@/services/notifications';

export default function NotificacionDetalleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme === 'dark' ? 'dark' : 'light'].tint;
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<{
    id: string;
    intento: number;
    data?: Notificacion;
    error?: string;
  } | null>(null);
  const vigente = resultado?.id === id && resultado.intento === intento;
  const cargando = Boolean(id) && !vigente;
  const notificacion = vigente ? resultado?.data : undefined;
  const error = vigente ? resultado?.error : undefined;

  useEffect(() => {
    if (!id) return;
    let active = true;
    getNotificationById(id)
      .then(async (data) => {
        if (!active) return;
        if (data && authSession.mode() === 'mock') await markNotificationRead(id);
        if (active) setResultado({ id, intento, data });
      })
      .catch((cause: unknown) => {
        if (active) {
          setResultado({
            id, intento,
            error: getApiErrorMessage(cause, 'No fue posible cargar la notificación.'),
          });
        }
      });
    return () => { active = false; };
  }, [id, intento]);

  if (cargando) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator color={tint} />
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText accessibilityRole="alert">{error}</ThemedText>
        <Action label="Reintentar" onPress={() => setIntento((value) => value + 1)} />
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
      <Action label="Revisar vínculos" onPress={() => router.push('/vinculos')} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 10 },
  hora: { fontSize: 12, opacity: 0.6 },
  descripcion: { fontSize: 15, lineHeight: 22, marginTop: 8 },
});
