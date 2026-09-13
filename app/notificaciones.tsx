import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StyleSheet } from 'react-native';

export default function NotificacionesScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Notificaciones</ThemedText>
      <ThemedText>Listado de notificaciones (pendiente).</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
});