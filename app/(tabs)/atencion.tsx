import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/** TI4-78: la navegación existe, pero Integra II aún no expone una API de consultas funcional. */
export default function AtencionScreen() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.card}>
        <ThemedText type="title">Atención médica</ThemedText>
        <ThemedText style={styles.description}>Módulo de consultas en desarrollo.</ThemedText>
        <ThemedText style={styles.note}>
          Todavía no es posible solicitar o revisar consultas, recetas ni documentos médicos desde esta pantalla.
          La integración estará disponible cuando Integra II habilite los endpoints correspondientes.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { gap: 12, alignItems: 'center' },
  description: { textAlign: 'center', fontWeight: '600' },
  note: { textAlign: 'center', opacity: 0.75, lineHeight: 22 },
});
