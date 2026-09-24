import { FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SEVERITY_COLORS, type Severidad } from '@/constants/severity';

// Reemplazar por datos reales cuando esté el endpoint de Evaluation
// (GET /api/v1/patients/{id}/alerts).
type AlertaItem = {
  id: string;
  severidad: Severidad;
  parametro: string;
  mensaje: string;
  fecha: string;
};

const ALERTAS: AlertaItem[] = [
  { id: '1', severidad: 'ALERTA', parametro: 'Presión arterial', mensaje: 'Presión sistólica con tendencia al alza sostenida durante 12 días.', fecha: 'Hoy · 08:15' },
  { id: '2', severidad: 'ADVERTENCIA', parametro: 'Glucemia en ayunas', mensaje: 'Glucemia por sobre el rango esperado en las últimas 2 mediciones.', fecha: 'Ayer · 08:02' },
  { id: '3', severidad: 'INFORMATIVA', parametro: 'Adherencia al registro', mensaje: 'Llevas 3 días sin registrar tu presión arterial.', fecha: 'Hace 3 días' },
];

export default function AlertasScreen() {
  if (ALERTAS.length === 0) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <ThemedText type="title">Alertas</ThemedText>
        <ThemedText>No tienes alertas activas por ahora.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={ALERTAS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const color = SEVERITY_COLORS[item.severidad];
          return (
            <View style={[styles.card, { backgroundColor: color.bg }]}>
              <View style={styles.cardHeader}>
                <ThemedText style={[styles.badge, { color: color.fg }]}>{item.severidad}</ThemedText>
                <ThemedText style={styles.fecha}>{item.fecha}</ThemedText>
              </View>
              <ThemedText type="defaultSemiBold" style={{ color: color.fg }}>{item.parametro}</ThemedText>
              <ThemedText style={[styles.mensaje, { color: color.fg }]}>{item.mensaje}</ThemedText>
            </View>
          );
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  list: { padding: 16, gap: 10 },
  card: { borderRadius: 12, padding: 14, gap: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  badge: { fontSize: 11, fontWeight: '700' },
  fecha: { fontSize: 11, opacity: 0.6 },
  mensaje: { fontSize: 13, lineHeight: 18 },
});
