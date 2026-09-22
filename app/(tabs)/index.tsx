import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ResumenScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Resumen de salud</ThemedText>
      <ThemedText>Presión, glucemia, peso (pendiente).</ThemedText>
      <Link href="/alertas">
        <ThemedText type="link">Ver todas las alertas →</ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
});