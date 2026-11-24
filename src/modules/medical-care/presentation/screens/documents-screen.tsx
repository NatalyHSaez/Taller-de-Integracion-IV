import { StyleSheet } from 'react-native';
import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';

export default function DocumentosScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Documentos médicos</ThemedText>
      <ThemedText style={styles.note}>La consulta de documentos médicos aún no está disponible.</ThemedText>
    </ThemedView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  note: { textAlign: 'center', opacity: 0.75 },
});
