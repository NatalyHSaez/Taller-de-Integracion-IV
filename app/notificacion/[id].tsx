import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Message, NotificationDetailView } from '@/src/modules/notifications/presentation/components/notifications-view';
import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';
import { Colors } from '@/src/shared/presentation/theme';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';
import { useNotifications } from '@/src/modules/notifications/presentation/hooks/use-notifications';

/**
 * Detalle de una notificación. El backend no tiene GET individual: se usa la
 * caché de lo ya listado. Si la app se abrió directo en esta ruta, se carga la
 * primera página antes de decidir que no está disponible.
 */
export default function NotificacionDetalleScreen() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = (Array.isArray(rawId) ? rawId[0] : rawId) ?? '';
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { state, store } = useNotifications();
  const notification = id ? store.get(id) : null;

  // Abrirla la marca como leída en el backend (una sola vez).
  const autoMarked = useRef(false);
  useEffect(() => {
    if (!notification || autoMarked.current) return;
    autoMarked.current = true;
    if (notification.status !== 'read') void store.markRead(notification.id);
  }, [notification, store]);

  const goToList = () => (router.canGoBack() ? router.back() : router.replace('/notificaciones'));

  if (!notification) {
    if (state.loading || (!state.loaded && !state.error && state.ownerId)) {
      return (
        <ThemedView style={styles.centered}>
          <ActivityIndicator color={theme.primary} />
        </ThemedView>
      );
    }
    return (
      <ThemedView style={styles.centered}>
        <Message
          theme={theme}
          icon="bell-off-outline"
          title={state.error ? 'No se pudo cargar la notificación.' : 'Notificación no disponible.'}
          text={
            state.error?.message ??
            'No está entre tus notificaciones más recientes o ya no existe. Ábrela desde la lista.'
          }
          action={
            state.error?.kind === 'network'
              ? { label: 'Reintentar', onPress: () => void store.refresh() }
              : { label: 'Ver notificaciones', onPress: goToList }
          }
        />
      </ThemedView>
    );
  }

  const markError = state.markError?.id === notification.id ? state.markError.message : null;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <NotificationDetailView
          notification={notification}
          marking={state.marking.includes(notification.id)}
          error={markError}
          theme={theme}
          onMarkRead={(nid) => void store.markRead(nid)}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Volver a notificaciones" onPress={goToList} style={styles.back}>
          <ThemedText style={[styles.bold, { color: theme.primary }]}>Volver a notificaciones</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 16, padding: 20 },
  centered: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 20 },
  back: { alignItems: 'center', paddingVertical: 12 },
  bold: { fontWeight: '700' },
});
