import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { useAppState } from "@/src/core/presentation/session/use-app-state";
import { useAuth } from "@/src/modules/identity/presentation/hooks/use-auth";
import {
  INTERNAL_NOTICE,
  NOTIFICATION_STATUS,
  formatDateTime,
} from "@/src/modules/notifications/presentation/components/notifications-view";
import { useNotifications } from "@/src/modules/notifications/presentation/hooks/use-notifications";
import { ThemedText } from "@/src/shared/presentation/components/themed-text";
import { ThemedView } from "@/src/shared/presentation/components/themed-view";
import { useColorScheme } from "@/src/shared/presentation/hooks/use-color-scheme";
import { Colors } from "@/src/shared/presentation/theme";

/**
 * Detalle de una notificación interna.
 * No hay GET /notifications/{id}: la información se consulta en el almacén
 * compartido con el listado, aislado por usuario autenticado.
 */
export default function NotificacionDetalleScreen() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = (Array.isArray(rawId) ? rawId[0] : rawId) ?? "";
  const theme = Colors[useColorScheme() === "dark" ? "dark" : "light"];
  const { sessionMode } = useAppState();
  const { user } = useAuth();
  const { state, store } = useNotifications();

  // No mostrar el contenido cacheado de otro usuario durante un cambio de sesión.
  const expectedOwner = sessionMode === "backend" ? (user?.id ?? null) : null;
  const ownerReady = expectedOwner !== null && state.ownerId === expectedOwner;
  const notification = ownerReady && id ? store.get(id) : null;
  const marking = !!id && state.marking.includes(id);
  const markError =
    ownerReady && state.markError?.id === id ? state.markError.message : null;

  const goToList = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/notificaciones");
  }, [router]);

  // A diferencia de la versión anterior de main, abrir el detalle NO marca
  // automáticamente como leída: la acción requiere pulsar el botón.
  const markRead = useCallback(async () => {
    if (
      !notification ||
      !ownerReady ||
      marking ||
      notification.status === "read"
    )
      return;
    const ownerAtStart = expectedOwner;
    await store.markRead(notification.id); // POST /notifications/{id}/read (HTTP 204).
    if (
      ownerAtStart !== null &&
      store.getState().ownerId === ownerAtStart &&
      store.getState().markError?.id !== notification.id
    ) {
      // Confirma el estado desde el servidor sin inventar un GET individual.
      await store.refresh();
    }
  }, [expectedOwner, marking, notification, ownerReady, store]);

  if (!expectedOwner) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>
          Inicia sesión para consultar tus notificaciones.
        </ThemedText>
        <BackButton onPress={goToList} color={theme.primary} />
      </ThemedView>
    );
  }

  if (!ownerReady || (!state.loaded && state.loading)) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText>Cargando notificación…</ThemedText>
      </ThemedView>
    );
  }

  if (!notification) {
    const error = state.error;
    return (
      <ThemedView style={styles.centered}>
        <ThemedText accessibilityRole="header" style={styles.title}>
          {error
            ? "No se pudo cargar la notificación."
            : "Notificación no disponible."}
        </ThemedText>
        <ThemedText style={[styles.centerMessage, { color: theme.mutedText }]}>
          {error?.message ??
            (!id
              ? "No se recibió un identificador de notificación."
              : "No se encuentra entre las notificaciones cargadas. Puedes buscarla en la lista y sus páginas siguientes.")}
        </ThemedText>
        {error?.kind === "network" && (
          <Pressable
            accessibilityRole="button"
            onPress={() => void store.refresh()}
            style={[styles.button, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={[styles.buttonText, { color: theme.onPrimary }]}>
              Reintentar
            </ThemedText>
          </Pressable>
        )}
        <BackButton onPress={goToList} color={theme.primary} />
      </ThemedView>
    );
  }

  const status = NOTIFICATION_STATUS[notification.status];
  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View
            style={[
              styles.badge,
              { backgroundColor: status.colors.background },
            ]}
          >
            <ThemedText
              style={[styles.badgeText, { color: status.colors.foreground }]}
            >
              {status.label}
            </ThemedText>
          </View>
          <ThemedText accessibilityRole="header" style={styles.title}>
            {notification.title}
          </ThemedText>
          <ThemedText style={[styles.description, { color: theme.text }]}>
            {notification.body}
          </ThemedText>
          <DetailRow
            label="Tipo"
            value={notification.type || "General"}
            muted={theme.mutedText}
          />
          <DetailRow
            label="Recibida"
            value={formatDateTime(notification.createdAt)}
            muted={theme.mutedText}
          />
          {notification.readAt && (
            <DetailRow
              label="Leída"
              value={formatDateTime(notification.readAt)}
              muted={theme.mutedText}
            />
          )}
          {markError && (
            <ThemedText
              accessibilityRole="alert"
              style={{ color: theme.danger }}
            >
              {markError}
            </ThemedText>
          )}
          {notification.status !== "read" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Marcar notificación como leída"
              accessibilityState={{ disabled: marking, busy: marking }}
              disabled={marking}
              onPress={() => void markRead()}
              style={[
                styles.button,
                { backgroundColor: theme.primary },
                marking && styles.disabled,
              ]}
            >
              {marking ? (
                <ActivityIndicator size="small" color={theme.onPrimary} />
              ) : (
                <ThemedText
                  style={[styles.buttonText, { color: theme.onPrimary }]}
                >
                  Marcar como leída
                </ThemedText>
              )}
            </Pressable>
          )}
        </View>
        <ThemedText style={[styles.note, { color: theme.mutedText }]}>
          {INTERNAL_NOTICE}
        </ThemedText>
        <BackButton onPress={goToList} color={theme.primary} />
      </ScrollView>
    </ThemedView>
  );
}

function DetailRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted: string;
}) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={[styles.meta, { color: muted }]}>{label}</ThemedText>
      <ThemedText style={styles.detailValue}>{value}</ThemedText>
    </View>
  );
}

function BackButton({
  onPress,
  color,
}: {
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Volver a notificaciones"
      onPress={onPress}
      style={styles.back}
    >
      <ThemedText style={[styles.backLabel, { color }]}>
        Volver a notificaciones
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 16, padding: 20, paddingBottom: 36 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },
  centerMessage: { textAlign: "center", fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 14, padding: 18, gap: 13 },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 12, fontWeight: "700" },
  title: { fontSize: 23, fontWeight: "800", lineHeight: 30 },
  description: { fontSize: 16, lineHeight: 24, marginVertical: 4 },
  detailRow: { gap: 3 },
  meta: { fontSize: 13 },
  detailValue: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  note: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  button: {
    alignItems: "center",
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 45,
    padding: 12,
  },
  buttonText: { fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.55 },
  back: { alignItems: "center", paddingVertical: 12 },
  backLabel: { fontWeight: "700" },
});
