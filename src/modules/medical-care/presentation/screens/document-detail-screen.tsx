import { StyleSheet } from 'react-native';

import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';

export default function DocumentoDetalleScreen() {

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Detalle del documento</ThemedText>
      <ThemedText>La consulta de documentos médicos aún no está disponible.</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
});
