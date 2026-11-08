import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import {
  INTERNAL_NOTICE,
  NotificationFilters,
  NotificationItem,
  NotificationsEmpty,
} from '@/src/modules/notifications/presentation/components/notifications-view';
import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';
import { Colors } from '@/src/shared/presentation/theme';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';
import { useNotifications } from '@/src/modules/notifications/presentation/hooks/use-notifications';

export default function NotificacionesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { state, store } = useNotifications();

  // Al volver (por ejemplo, desde el detalle) se consulta de nuevo al backend.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void store.refresh();
    }, [store]),
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={state.loaded ? state.items : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, (!state.loaded || state.items.length === 0) && styles.grow]}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => void store.refresh()}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (!state.loadMoreError) void store.loadMore();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText style={[styles.small, { color: theme.mutedText }]}>{INTERNAL_NOTICE}</ThemedText>
            {state.ownerId && <NotificationFilters state={state} theme={theme} onFilter={(f) => void store.setFilter(f)} />}
            {state.error && state.loaded && (
              <ThemedText accessibilityRole="alert" style={[styles.small, { color: theme.danger }]}>
                No se pudo actualizar: {state.error.message}
              </ThemedText>
            )}
            {state.markError && (
              <ThemedText accessibilityRole="alert" style={[styles.small, { color: theme.danger }]}>
                {state.markError.message}
              </ThemedText>
            )}
          </View>
        }
        ListEmptyComponent={<NotificationsEmpty state={state} theme={theme} onRetry={() => void store.refresh()} />}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            marking={state.marking.includes(item.id)}
            theme={theme}
            onOpen={(id) => router.push({ pathname: '/notificacion/[id]', params: { id } })}
            onMarkRead={(id) => void store.markRead(id)}
          />
        )}
        ItemSeparatorComponent={Separator}
        ListFooterComponent={
          !state.loaded || state.items.length === 0 ? null : state.loadingMore ? (
            <ActivityIndicator style={styles.footer} color={theme.primary} />
          ) : state.loadMoreError ? (
            <View style={styles.footer}>
              <ThemedText accessibilityRole="alert" style={[styles.small, { color: theme.danger }]}>
                {state.loadMoreError}
              </ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel="Reintentar" onPress={() => void store.loadMore()}>
                <ThemedText style={[styles.small, styles.bold, { color: theme.primary }]}>Reintentar</ThemedText>
              </Pressable>
            </View>
          ) : state.hasMore ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cargar más"
              onPress={() => void store.loadMore()}
              style={styles.footer}>
              <ThemedText style={[styles.bold, { color: theme.primary }]}>Cargar más</ThemedText>
            </Pressable>
          ) : (
            <ThemedText style={[styles.small, styles.footerText, { color: theme.mutedText }]}>
              No hay más notificaciones.
            </ThemedText>
          )
        }
      />
    </ThemedView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16 },
  grow: { flexGrow: 1 },
  header: { gap: 10, marginBottom: 12 },
  separator: { height: 10 },
  small: { fontSize: 13, lineHeight: 18 },
  bold: { fontWeight: '700' },
  footer: { alignItems: 'center', gap: 6, paddingVertical: 18 },
  footerText: { paddingVertical: 18, textAlign: 'center' },
});
