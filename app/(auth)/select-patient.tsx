import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SelectPatientScreen() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<'AUTONOMOUS' | 'ASSISTED' | null>(null);

  const handleContinue = () => {
    if (selectedMode) {
      // Redirigir a las tabs principales de la aplicación
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.stepText}>PASO 2 DE 2</Text>
        <Text style={styles.title}>Modo de Gestión</Text>
        <Text style={styles.subtitle}>Selecciona cómo se administrarán las mediciones e historial de salud.</Text>

        <TouchableOpacity 
          style={[styles.card, selectedMode === 'AUTONOMOUS' && styles.cardSelected]} 
          onPress={() => setSelectedMode('AUTONOMOUS')}
        >
          <Text style={styles.cardTitle}>Paciente Autónomo</Text>
          <Text style={styles.cardDescription}>Administras directamente tus lecturas, mediciones y accesos médicos.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.card, selectedMode === 'ASSISTED' && styles.cardSelected]} 
          onPress={() => setSelectedMode('ASSISTED')}
        >
          <Text style={styles.cardTitle}>Paciente Asistido / Cuidador</Text>
          <Text style={styles.cardDescription}>Un familiar o cuidador autorizado colaborará registrando datos y mediciones.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.primaryButton, !selectedMode && styles.disabledButton]} 
          disabled={!selectedMode} 
          onPress={handleContinue}
        >
          <Text style={styles.primaryButtonText}>Finalizar Configuración</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 24, paddingTop: 40 },
  stepText: { fontSize: 12, color: '#6B7280', letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#4B5563', marginBottom: 24 },
  card: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, marginBottom: 16, backgroundColor: '#F9FAFB' },
  cardSelected: { borderColor: '#0F4C81', backgroundColor: '#F0F7FF', borderWidth: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  cardDescription: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  primaryButton: { backgroundColor: '#0F4C81', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 24 },
  disabledButton: { backgroundColor: '#9CA3AF' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});