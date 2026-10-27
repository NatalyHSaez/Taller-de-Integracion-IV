import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '@/config/api';
import { Colors, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getApiErrorMessage } from '@/services/errors';
import { gatewayService } from '@/services/gateway';
import type { HealthResponse } from '@/types/api';

type HealthViewState =
  | { kind: 'loading' }
  | { kind: 'ready'; response: HealthResponse }
  | { kind: 'error'; message: string };

export function GatewayHealthCard() {
  const theme = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [state, setState] = useState<HealthViewState>({ kind: 'loading' });

  const checkHealth = useCallback(async (forceRefresh = false, signal?: AbortSignal) => {
    setState({ kind: 'loading' });

    try {
      const response = await gatewayService.health({ forceRefresh, signal });
      setState({ kind: 'ready', response });
    } catch (cause) {
      if (signal?.aborted) {
        return;
      }

      setState({
        kind: 'error',
        message: getApiErrorMessage(
          cause,
          'No fue posible comprobar la conexión con el servidor.',
        ),
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    gatewayService
      .health({ signal: controller.signal })
      .then((response) => setState({ kind: 'ready', response }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          kind: 'error',
          message: getApiErrorMessage(
            cause,
            'No fue posible comprobar la conexión con el servidor.',
          ),
        });
      });

    return () => controller.abort();
  }, []);

  const isReady = state.kind === 'ready';
  const isHealthy = isReady && state.response.status === 'ok';
  const statusColor = isHealthy
    ? StatusColors.normal.foreground
    : state.kind === 'loading'
      ? theme.mutedText
      : theme.danger;
  const statusIcon = isHealthy
    ? 'check-circle-outline'
    : state.kind === 'loading'
      ? 'progress-clock'
      : 'alert-circle-outline';
  const statusLabel =
    state.kind === 'loading'
      ? 'Comprobando conexión...'
      : state.kind === 'error'
        ? 'No fue posible conectar'
        : isHealthy
          ? 'Servidor disponible'
          : 'Servidor parcialmente disponible';

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={styles.header}>
        {state.kind === 'loading' ? (
          <ActivityIndicator color={statusColor} size="small" />
        ) : (
          <MaterialCommunityIcons color={statusColor} name={statusIcon} size={21} />
        )}

        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.text }]}>Estado del servidor</Text>
          <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <Text selectable style={[styles.url, { color: theme.mutedText }]}>
        {API_BASE_URL ?? 'Configura EXPO_PUBLIC_API_URL para conectarte al Gateway.'}
      </Text>

      {state.kind === 'ready' && state.response.status === 'degradado' && (
        <View style={styles.services}>
          {Object.entries(state.response.servicios).map(([service, status]) => (
            <Text key={service} style={[styles.service, { color: theme.text }]}>
              {service}: {status}
            </Text>
          ))}
        </View>
      )}

      {state.kind === 'error' && (
        <Text style={[styles.message, { color: theme.danger }]}>{state.message}</Text>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={state.kind === 'loading'}
        onPress={() => void checkHealth(true)}
        style={({ pressed }) => [
          styles.retry,
          { borderColor: theme.primary },
          (pressed || state.kind === 'loading') && styles.faded,
        ]}
      >
        <Text style={[styles.retryText, { color: theme.primary }]}>Comprobar conexión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 },
  faded: { opacity: 0.6 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  headerText: { flex: 1, gap: 2 },
  message: { fontSize: 13, lineHeight: 18 },
  retry: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  retryText: { fontSize: 14, fontWeight: '700' },
  service: { fontSize: 12, lineHeight: 18 },
  services: { gap: 2 },
  status: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 15, fontWeight: '800' },
  url: { fontSize: 12, lineHeight: 17 },
});
