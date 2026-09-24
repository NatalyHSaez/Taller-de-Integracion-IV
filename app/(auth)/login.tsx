import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSession, setKeepSession] = useState(true);

  const handleLogin = () => {
    // Redirige al grupo (tabs), que por defecto renderiza app/(tabs)/index.tsx (tu Home)
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSquare} />
          <Text style={styles.brandTitle}>Domicilia</Text>
        </View>

        <Text style={styles.stepText}>PASO 1 DE 2</Text>
        <Text style={styles.title}>Acceso a la plataforma</Text>
        <Text style={styles.subtitle}>
          Ingresa con tus credenciales para acceder a tu seguimiento de salud.
        </Text>

        {/* Formulario */}
        <View style={styles.form}>
          <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="usuario@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>CONTRASEÑA</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="••••••••••••"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.toggleText}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.optionsRow}>
            <TouchableOpacity 
              style={styles.checkboxRow} 
              onPress={() => setKeepSession(!keepSession)}
            >
              <View style={[styles.checkbox, keepSession && styles.checkboxChecked]} />
              <Text style={styles.optionText}>Mantener sesión</Text>
            </TouchableOpacity>

            <TouchableOpacity>
              <Text style={styles.linkText}>Olvidé mi contraseña</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
            <Text style={styles.primaryButtonText}>Continuar</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/register')} style={styles.registerLink}>
            <Text style={styles.footerQuestion}>
              ¿Aún no tienes cuenta? <Text style={styles.linkText}>Regístrate aquí</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 24, paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  logoSquare: { width: 24, height: 24, backgroundColor: '#0F4C81', borderRadius: 6, marginRight: 8 },
  brandTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F4C81' },
  stepText: { fontSize: 12, color: '#6B7280', letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#4B5563', marginBottom: 28, lineHeight: 20 },
  form: { width: '100%' },
  label: { fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 6, letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 16 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, marginBottom: 16 },
  passwordInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  toggleText: { color: '#0F4C81', fontWeight: '600', fontSize: 13 },
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 4, marginRight: 8 },
  checkboxChecked: { backgroundColor: '#0F4C81', borderColor: '#0F4C81' },
  optionText: { fontSize: 13, color: '#374151' },
  linkText: { fontSize: 13, color: '#0F4C81', fontWeight: '600' },
  primaryButton: { backgroundColor: '#0F4C81', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  registerLink: { alignItems: 'center', marginTop: 12 },
  footerQuestion: { fontSize: 14, color: '#4B5563' },
});