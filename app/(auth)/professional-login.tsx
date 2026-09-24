import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StyleSheet } from 'react-native';

export default function ProfessionalLoginScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">Paso 1 de 2</ThemedText>
      <ThemedText type="title">Acceso para médicos</ThemedText>
      <ThemedText>Login en 2 pasos con verificación profesional (pendiente).</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
});