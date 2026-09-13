import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StyleSheet } from 'react-native';

export default function SelectPatientScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Selección de paciente</ThemedText>
      <ThemedText>Elegir modo autónomo/asistido (pendiente).</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
});