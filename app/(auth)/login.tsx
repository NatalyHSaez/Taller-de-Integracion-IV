import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function LoginScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Login</ThemedText>
      <ThemedText>Formulario de inicio de sesión (pendiente).</ThemedText>
      <Link href="/professional-login"></Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
});