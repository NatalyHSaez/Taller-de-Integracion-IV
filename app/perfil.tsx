import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Reemplazar por datos reales cuando esté el endpoint de Relations
// (GET /api/v1/patients/{id}/caregivers y /doctors).
type Relacion = {
  id: string;
  nombre: string;
  rol: 'Cuidador' | 'Médico';
  detalle: string;
};

const RELACIONES_INICIALES: Relacion[] = [
  { id: '1', nombre: 'Josefina Ríos', rol: 'Cuidador', detalle: 'Vinculada desde ago 2026' },
  { id: '2', nombre: 'Dr. Alejandro Pérez', rol: 'Médico', detalle: 'Medicina general · Verificado' },
];

export default function PerfilScreen() {
  const [relaciones, setRelaciones] = useState(RELACIONES_INICIALES);

  const confirmarRevocacion = (relacion: Relacion) => {
    Alert.alert(
      'Revocar acceso',
      `¿Seguro que quieres revocarle el acceso a ${relacion.nombre}? Ya no podrá ver ni registrar tu información.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revocar',
          style: 'destructive',
          onPress: () => {
            // Reemplazar por DELETE /api/v1/relations/{id} cuando exista el endpoint
            setRelaciones((prev) => prev.filter((r) => r.id !== relacion.id));
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Perfil</ThemedText>

      <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
        Cuidadores y médicos vinculados
      </ThemedText>

      {relaciones.length === 0 ? (
        <ThemedText style={styles.empty}>No tienes cuidadores ni médicos vinculados.</ThemedText>
      ) : (
        <FlatList
          data={relaciones}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.textGroup}>
                <ThemedText type="defaultSemiBold">{item.nombre}</ThemedText>
                <ThemedText style={styles.detalle}>{item.rol} · {item.detalle}</ThemedText>
              </View>
              <Pressable onPress={() => confirmarRevocacion(item)} style={styles.revokeButton}>
                <ThemedText style={styles.revokeText}>Revocar</ThemedText>
              </Pressable>
            </View>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16 },
  title: { marginBottom: 4 },
  sectionTitle: { fontSize: 13, opacity: 0.7 },
  empty: { opacity: 0.6, paddingVertical: 8 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 14,
  },
  textGroup: { flex: 1, gap: 2 },
  detalle: { fontSize: 12, opacity: 0.6 },
  revokeButton: {
    borderWidth: 1,
    borderColor: '#E9C4C0',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  revokeText: { color: '#C1443A', fontSize: 12, fontWeight: '700' },
});