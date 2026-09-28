import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { type AlertaItem } from '@/constants/alerts-mock';
import { SEVERITY_STYLE } from '@/constants/severity';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAlerts } from '@/services/alerts';

export default function AlertasScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [alertas, setAlertas] = useState<AlertaItem[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getAlerts().then((data) => {
      setAlertas(data);
      setCargando(false);
    });
  }, []);

  if (cargando) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  if (alertas.length === 0) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <ThemedText type="title">Alertas activas</ThemedText>
        <ThemedText>No tienes alertas activas por ahora.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Alertas activas</ThemedText>
      <FlatList
        data={alertas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const severity = SEVERITY_STYLE[item.severidad];
          return (
            <View
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
        Las alertas se generan por tendencia sostenida, nunca por un valor aislado.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  title: { paddingHorizontal: 16, marginBottom: 4 },
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
