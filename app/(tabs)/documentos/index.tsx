import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// TODO: reemplazar por datos reales cuando esté el endpoint de documentos
const DOCUMENTOS = [
  { id: 'receta-medica', nombre: 'Receta médica.pdf' },
  { id: 'orden-examenes', nombre: 'Orden de exámenes.pdf' },
];

export default function DocumentosScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={DOCUMENTOS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/documentos/${item.id}`)}>
            <ThemedText>{item.nombre}</ThemedText>
            <ThemedText type="link">Ver documento</ThemedText>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
});