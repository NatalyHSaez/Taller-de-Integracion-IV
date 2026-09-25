import { authService, Patient } from '@/services/authservice';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function SelectPatientScreen() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<'AUTONOMOUS' | 'ASSISTED' | null>(null);
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const handleSelectMode = async (mode: 'AUTONOMOUS' | 'ASSISTED') => {
    setSelectedMode(mode);
    setSelectedPatientId(null);

    if (mode === 'ASSISTED') {
      try {
        setLoading(true);
        const data = await authService.getPatients();
        setPatients(data);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'No se pudieron obtener los pacientes vinculados.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleFinish = () => {
    if (!selectedMode) return;

    if (selectedMode === 'ASSISTED' && !selectedPatientId) {
      Alert.alert('Atención', 'Selecciona un paciente de la lista para continuar.');
      return;
    }

    // Registro configurado con éxito -> Entra directamente al Home/Tabs
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.stepText}>PASO 2 DE 2</Text>
        <Text style={styles.title}>Modo de Gestión</Text>
        <Text style={styles.subtitle}>Selecciona cómo se administrarán las mediciones e historial de salud.</Text>

        {/* Tarjeta Autónomo */}
        <TouchableOpacity 
          style={[styles.card, selectedMode === 'AUTONOMOUS' && styles.cardSelected]} 
          onPress={() => handleSelectMode('AUTONOMOUS')}
          disabled={loading}
        >
          <Text style={styles.cardTitle}>Paciente Autónomo</Text>
          <Text style={styles.cardDescription}>Administras directamente tus lecturas, mediciones y accesos médicos.</Text>
        </TouchableOpacity>

        {/* Tarjeta Asistido */}
        <TouchableOpacity 
          style={[styles.card, selectedMode === 'ASSISTED' && styles.cardSelected]} 
          onPress={() => handleSelectMode('ASSISTED')}
          disabled={loading}
        >
          <Text style={styles.cardTitle}>Paciente Asistido / Cuidador</Text>
          <Text style={styles.cardDescription}>Un familiar o cuidador autorizado colaborará registrando datos y mediciones.</Text>
        </TouchableOpacity>

        {/* Lista de Pacientes cuando se elige ASSISTED */}
        {selectedMode === 'ASSISTED' && (
          <View style={styles.patientsContainer}>
            <Text style={styles.sectionTitle}>Selecciona el paciente a monitorear:</Text>
            {loading ? (
              <ActivityIndicator color="#0F4C81" style={{ marginVertical: 12 }} />
            ) : (
              patients.map((patient) => (
                <TouchableOpacity
                  key={patient.id}
                  style={[
                    styles.patientItem,
                    selectedPatientId === patient.id && styles.patientItemSelected
                  ]}
                  onPress={() => setSelectedPatientId(patient.id)}
                >
                  <Text style={styles.patientName}>{patient.fullName}</Text>
                  <Text style={styles.patientDetail}>{patient.relationship} • {patient.age} años</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <TouchableOpacity 
          style={[
            styles.primaryButton, 
            (!selectedMode || (selectedMode === 'ASSISTED' && !selectedPatientId) || loading) && styles.disabledButton
          ]} 
          disabled={!selectedMode || (selectedMode === 'ASSISTED' && !selectedPatientId) || loading} 
          onPress={handleFinish}
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
  subtitle: { fontSize: 14, color: '#4B5563', marginBottom: 20 },
  card: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, marginBottom: 12, backgroundColor: '#F9FAFB' },
  cardSelected: { borderColor: '#0F4C81', backgroundColor: '#F0F7FF', borderWidth: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  cardDescription: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  patientsContainer: { marginTop: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  patientItem: { padding: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, marginBottom: 8 },
  patientItemSelected: { borderColor: '#0F4C81', backgroundColor: '#E0F2FE' },
  patientName: { fontSize: 14, fontWeight: 'bold', color: '#1F2937' },
  patientDetail: { fontSize: 12, color: '#6B7280' },
  primaryButton: { backgroundColor: '#0F4C81', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  disabledButton: { backgroundColor: '#9CA3AF' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});