import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { type AlertaItem } from '@/constants/alerts-mock';
import { SEVERITY_STYLE } from '@/constants/severity';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAlerts } from '@/services/alerts';
import { getApiErrorMessage } from '@/services/errors';
import { useAppState } from '@/hooks/use-app-state';

export default function AlertasScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [alertas, setAlertas] = useState<AlertaItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedMode, setResolvedMode] = useState<'mock' | 'backend' | null>(null);
  const { sessionMode } = useAppState();
  const requestId = useRef(0);

  const cargar = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const data = await getAlerts();
      if (id !== requestId.current) return;
      setError(null);
      setAlertas(data);
      setResolvedMode(sessionMode);
    } catch (cause: unknown) {
      if (id !== requestId.current) return;
      setAlertas([]);
      setError(getApiErrorMessage(cause));
      setResolvedMode(sessionMode);
    } finally {
      if (id === requestId.current) setCargando(false);
    }
  }, [sessionMode]);

  useEffect(() => {
    let activo = true;
    const contadorSolicitudes = requestId;

    // Se inicia después del efecto para evitar actualizaciones síncronas de estado.
    void Promise.resolve().then(() => {
      if (activo) return cargar();
    });

    return () => {
      activo = false;
      contadorSolicitudes.current += 1;
    };
  }, [cargar]);

  const onRefresh = useCallback(() => {
    setRefrescando(true);
    cargar().finally(() => setRefrescando(false));
  }, [cargar]);

  if (cargando || resolvedMode !== sessionMode) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={alertas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={alertas.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContent}>
            <ThemedText accessibilityRole={error ? 'alert' : undefined}>
              {error ?? 'No tienes alertas activas por ahora.'}
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => {
          const severity = SEVERITY_STYLE[item.severidad];
          return (
            <View
              accessible
              accessibilityLabel={`${severity.label}. ${item.parametro}. ${item.mensaje}`}
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderLeftColor: severity.border },
              ]}>
              <View style={[styles.badge, { backgroundColor: severity.bg }]}>
                <ThemedText style={[styles.badgeText, { color: severity.fg }]}>
                  {severity.icon} {severity.label}
                </ThemedText>
              </View>
              <ThemedText type="defaultSemiBold" style={styles.mensaje}>
                {item.mensaje}
              </ThemedText>
              {item.comparacion && (
                <ThemedText style={styles.comparacion}>{item.comparacion}</ThemedText>
              )}
              <ThemedText style={styles.footerText}>
                {item.fecha} · {item.hora} · regla {item.regla}
              </ThemedText>
            </View>
          );
        }}
      />
      <ThemedText style={styles.disclaimer}>
        Las alertas informan sobre reglas de seguimiento configuradas y no sustituyen la evaluación médica.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  emptyList: { flexGrow: 1 },
  emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  list: { padding: 16, gap: 12 },
  card: {
    borderLeftWidth: 4,
    borderRadius: 10,
    padding: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  badge: { alignSelf: 'flex-start', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  mensaje: { fontSize: 14, lineHeight: 19 },
  comparacion: { fontSize: 12, opacity: 0.65 },
  footerText: { fontSize: 11, opacity: 0.55, marginTop: 4 },
  disclaimer: { fontSize: 11, opacity: 0.5, textAlign: 'center', paddingVertical: 14, paddingHorizontal: 24 },
});