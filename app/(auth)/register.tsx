import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = () => {
    // Registro mock o API
    router.push('/select-patient');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.stepText}>PASO 1 DE 2</Text>
        <Text style={styles.title}>Crear una cuenta</Text>
        <Text style={styles.subtitle}>Completa tus datos personales para comenzar.</Text>

        <Text style={styles.label}>NOMBRES</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Juan" />

        <Text style={styles.label}>APELLIDOS</Text>
        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Pérez" />

        <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

        <Text style={styles.label}>CONTRASEÑA</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••••••" />

        <TouchableOpacity style={styles.primaryButton} onPress={handleRegister}>
          <Text style={styles.primaryButtonText}>Registrarme</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={{ alignItems: 'center' }}>
          <Text style={{ color: '#0F4C81', fontWeight: '600' }}>¿Ya tienes cuenta? Inicia sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 20 },
  stepText: { fontSize: 12, color: '#6B7280', letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#4B5563', marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 16 },
  primaryButton: { backgroundColor: '#0F4C81', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 12, marginBottom: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});