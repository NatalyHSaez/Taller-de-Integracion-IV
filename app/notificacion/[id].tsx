import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAppState } from '@/hooks/use-app-state';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authSession } from '@/services/auth-session';
import { getApiErrorMessage } from '@/services/errors';
import { notificationsService, type NotificationItem } from '@/services/notifications';

function currentScope(): string {
  return `${authSession.generation()}:${authSession.mode() ?? '-'}:${authSession.user()?.id ?? '-'}`;
}

export default function NotificacionDetalleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const { user, sessionMode } = useAppState();
  const scope = `${authSession.generation()}:${sessionMode ?? '-'}:${user?.id ?? '-'}`;
  const [result, setResult] = useState<{ key: string; item?: NotificationItem; error?: string } | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef(0);
  const key = `${scope}:${id ?? ''}:${attempt}`;
  const current = result?.key === key;
  const loading = Boolean(id) && !current;
  const item = current ? result?.item : undefined;
  const error = current ? result?.error : undefined;

  useEffect(() => {
    const requestId = ++requestRef.current;
    if (!id) return;
    void Promise.resolve().then(() => notificationsService.detail(id))
      .then((value) => {
        if (requestId === requestRef.current) setResult({ key, item: value });
      })
      .catch((cause: unknown) => {
        if (requestId === requestRef.current) setResult({ key,
          error: getApiErrorMessage(cause, 'No fue posible abrir esta notificación.') });
      });
    return () => { requestRef.current += 1; };
  }, [id, key]);

  const markRead = useCallback(async () => {
    if (!id || !item || marking) return;
    const originalScope = scope;
    setMarking(true);
    setMarkError(null);
    try {
      await notificationsService.markRead(id);
      if (currentScope() !== originalScope) return;
      // La API no ofrece GET por ID. Se actualiza tras el HTTP 204 confirmado.
      const updated = await notificationsService.detail(id);
      if (currentScope() === originalScope) {
        setResult({ key, item: updated });
      }
    } catch (cause: unknown) {
      if (currentScope() === originalScope) {
        setMarkError(getApiErrorMessage(cause, 'No se pudo marcar esta notificación.'));
      }
    } finally {
      setMarking(false);
    }
  }, [id, item, key, marking, scope]);

  if (loading) return <ThemedView style={styles.center}><ActivityIndicator color={theme.primary} /></ThemedView>;

  return (
    <ThemedView style={styles.container}>
      {error ? (
        <View style={styles.center}>
          <ThemedText accessibilityRole="alert">{error}</ThemedText>
          <Pressable accessibilityRole="button" onPress={() => setAttempt((n) => n + 1)}>
            <ThemedText style={{ color: theme.primary }}>Reintentar</ThemedText>
          </Pressable>
        </View>
      ) : !item ? (
        <View style={styles.center}>
          <ThemedText>No encontramos esta notificación entre los avisos cargados.</ThemedText>
          <ThemedText style={styles.info}>El backend no dispone de consulta individual por ID. Puedes buscarla en el listado, incluidas las páginas siguientes.</ThemedText>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/notificaciones')}>
            <ThemedText style={{ color: theme.primary }}>Ver todas las notificaciones</ThemedText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.content}>
          <ThemedText type="title">{item.titulo}</ThemedText>
          <ThemedText style={styles.info}>{item.hora}</ThemedText>
          <ThemedText style={styles.description}>{item.descripcion}</ThemedText>
          <ThemedText style={styles.info}>Tipo: {item.type}</ThemedText>
          <ThemedText style={styles.info}>Estado: {item.status === 'read' ? 'Leída' : item.status === 'sent' ? 'Enviada' : 'Pendiente'}</ThemedText>
          {item.readAt && <ThemedText style={styles.info}>Lectura: {new Date(item.readAt).toLocaleString('es-CL')}</ThemedText>}
          {markError && <ThemedText accessibilityRole="alert">{markError}</ThemedText>}
          {!item.leida && (
            <Pressable accessibilityRole="button" disabled={marking} onPress={() => void markRead()}
              style={[styles.button, { backgroundColor: theme.primary }, marking && { opacity: 0.5 }]}>
              <ThemedText style={styles.buttonText}>{marking ? 'Guardando…' : 'Marcar como leída'}</ThemedText>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={() => router.replace('/notificaciones')}>
            <ThemedText style={{ color: theme.primary }}>Volver a notificaciones</ThemedText>
          </Pressable>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  content: { gap: 12 },
  description: { fontSize: 16, lineHeight: 24, marginTop: 8 },
  info: { opacity: 0.7, fontSize: 13, lineHeight: 20 },
  button: { alignSelf: 'flex-start', borderRadius: 10, padding: 14, marginTop: 14 },
  buttonText: { color: '#FFFFFF', fontWeight: '600' },
});
