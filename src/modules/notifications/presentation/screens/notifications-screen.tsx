import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";

import type {
  AppNotification,
  NotificationFilter,
} from "@/src/modules/notifications/domain/notification";
import {
  INTERNAL_NOTICE,
  formatDateTime,
} from "@/src/modules/notifications/presentation/components/notifications-view";
import { useNotifications } from "@/src/modules/notifications/presentation/hooks/use-notifications";
import { ThemedText } from "@/src/shared/presentation/components/themed-text";
import { ThemedView } from "@/src/shared/presentation/components/themed-view";
import { useColorScheme } from "@/src/shared/presentation/hooks/use-color-scheme";
import { Colors } from "@/src/shared/presentation/theme";

const FILTERS: readonly { key: NotificationFilter; label: string }[] = [
  { key: "unread", label: "No leídas" },
  { key: "read", label: "Leídas" },
];

const STATUS_LABELS: Record<AppNotification["status"], string> = {
  pending: "No leída",
  sent: "No leída",
  read: "Leída",
};

export default function NotificacionesScreen() {
  const router = useRouter();
  const theme = Colors[useColorScheme() === "dark" ? "dark" : "light"];
  const { state, store, ownerId, ownerReady, sessionRevision } = useNotifications();

  // No presentar avisos de la cuenta anterior mientras cambia la sesión.
  const items = ownerReady && state.loaded ? state.items : [];
  const loading =
    ownerId !== null && (!ownerReady || (state.loading && !state.loaded));

  // La primera carga corresponde al hook; al regresar desde el detalle, actualizar.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (ownerReady) void store.refresh();
    }, [ownerReady, store]),
  );

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!store.isOwner(ownerId, sessionRevision)) return;
      const previousOwner = ownerId;
      await store.markRead(notificationId); // POST /notifications/{id}/read (204).
      // Cristian: verificar el estado consultando nuevamente al servidor.
      if (
        previousOwner !== null &&
        store.isOwner(previousOwner, sessionRevision) &&
        store.getState().markError?.id !== notificationId
      ) {
        await store.refresh();
      }
    },
    [store, ownerId, sessionRevision],
  );

  const refresh = useCallback(() => {
    if (ownerReady) void store.refresh();
  }, [ownerReady, store]);

  const renderItem = ({ item }: { item: AppNotification }) => {
    const unread = item.status !== "read";
    const marking = state.marking.includes(item.id);
    return (
      <View
        style={[
          styles.row,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${item.title}`}
          onPress={() =>
            router.push({
              pathname: "/notificacion/[id]",
              params: { id: item.id },
            })
          }
          style={({ pressed }) => [
            styles.rowContent,
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.dot,
              { backgroundColor: unread ? theme.primary : theme.border },
            ]}
          />
          <View style={styles.textGroup}>
            <ThemedText style={unread ? styles.unreadTitle : undefined}>
              {item.title}
            </ThemedText>
            <ThemedText
              numberOfLines={2}
              style={[styles.body, { color: theme.mutedText }]}
            >
              {item.body}
            </ThemedText>
            <ThemedText style={[styles.meta, { color: theme.mutedText }]}>
              {formatDateTime(item.createdAt)} · {STATUS_LABELS[item.status]}
            </ThemedText>
          </View>
        </Pressable>
        {unread && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Marcar notificación como leída"
            accessibilityState={{ disabled: marking, busy: marking }}
            disabled={marking}
            onPress={() => void markRead(item.id)}
            style={({ pressed }) => [
              styles.markButton,
              { backgroundColor: theme.primary },
              marking && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {marking ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <ThemedText style={[styles.markText, { color: theme.onPrimary }]}>
                Marcar como leída
              </ThemedText>
            )}
          </Pressable>
        )}
      </View>
    );
  };

  const error = ownerReady ? state.error : null;
  const canRetry = error?.kind === "network";

  return (
    <ThemedView style={styles.container}>
      <View
        style={styles.filters}
        accessibilityRole="tablist"
        accessibilityLabel="Filtrar notificaciones"
      >
        {FILTERS.map((filter) => {
          const selected = state.filter === filter.key;
          return (
            <Pressable
              key={filter.key}
              accessibilityRole="tab"
              accessibilityState={{ selected, disabled: !ownerReady }}
              accessibilityLabel={`Filtrar: ${filter.label}`}
              disabled={!ownerReady}
              onPress={() => void store.setFilter(filter.key)}
              style={({ pressed }) => [
                styles.filter,
                {
                  backgroundColor: selected ? theme.primary : theme.surface,
                  borderColor: theme.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <ThemedText
                style={[
                  styles.filterLabel,
                  { color: selected ? theme.onPrimary : theme.text },
                ]}
              >
                {filter.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {loading || !ownerId ? (
        <View style={styles.center}>
          {loading && <ActivityIndicator color={theme.primary} />}
          <ThemedText style={styles.message}>
            {loading
              ? "Cargando notificaciones…"
              : "Inicia sesión para ver notificaciones."}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={ownerReady && state.refreshing}
              onRefresh={refresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText style={[styles.small, { color: theme.mutedText }]}>
                {INTERNAL_NOTICE}
              </ThemedText>
              {ownerReady && state.loaded && !error && (
                <ThemedText style={[styles.small, { color: theme.mutedText }]}>
                  {state.filter === 'unread'
                    ? `${items.length} notificaciones sin leer cargadas`
                    : `${items.length} de ${state.total} notificaciones leídas cargadas`}
                </ThemedText>
              )}
              {error && (
                <ThemedText
                  accessibilityRole="alert"
                  style={[styles.small, { color: theme.danger }]}
                >
                  {error.message}
                </ThemedText>
              )}
              {ownerReady && state.markError && (
                <ThemedText
                  accessibilityRole="alert"
                  style={[styles.small, { color: theme.danger }]}
                >
                  {state.markError.message}
                </ThemedText>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <ThemedText style={styles.message}>
                {error
                  ? "No se pudieron consultar las notificaciones."
                  : "No hay notificaciones para este filtro."}
              </ThemedText>
              {canRetry && (
                <Pressable
                  accessibilityRole="button"
                  onPress={refresh}
                  style={styles.retry}
                >
                  <ThemedText style={{ color: theme.primary }}>
                    Reintentar
                  </ThemedText>
                </Pressable>
              )}
            </View>
          }
          ListFooterComponent={
            !ownerReady ||
            !state.loaded ||
            items.length === 0 ? null : state.loadingMore ? (
              <ActivityIndicator style={styles.footer} color={theme.primary} />
            ) : state.loadMoreError ? (
              <View style={styles.footer}>
                <ThemedText
                  accessibilityRole="alert"
                  style={{ color: theme.danger }}
                >
                  {state.loadMoreError}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void store.loadMore()}
                >
                  <ThemedText style={{ color: theme.primary }}>
                    Reintentar carga
                  </ThemedText>
                </Pressable>
              </View>
            ) : state.hasMore ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void store.loadMore()}
                style={[styles.more, { borderColor: theme.border }]}
              >
                <ThemedText style={{ color: theme.primary }}>
                  {state.filter === 'unread' ? 'Cargar más notificaciones' : `Cargar más (${items.length} de ${state.total})`}
                </ThemedText>
              </Pressable>
            ) : null
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
    paddingBottom: 12,
  },
  filter: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterLabel: { fontSize: 12, fontWeight: "600" },
  center: {
    flex: 1,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 20,
  },
  list: { flexGrow: 1, paddingHorizontal: 12, paddingBottom: 24, gap: 10 },
  header: { gap: 6, paddingBottom: 12 },
  row: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  rowContent: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
  textGroup: { flex: 1, gap: 4 },
  unreadTitle: { fontWeight: "700" },
  body: { fontSize: 14 },
  meta: { fontSize: 12 },
  markButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  markText: { fontWeight: "600", fontSize: 12 },
  more: { alignItems: "center", padding: 12, borderWidth: 1, borderRadius: 10 },
  footer: { alignItems: "center", gap: 8, paddingVertical: 16 },
  retry: { padding: 10 },
  message: { textAlign: "center" },
  small: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});
