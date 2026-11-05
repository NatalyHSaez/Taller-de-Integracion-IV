
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppState } from '@/hooks/use-app-state';
import { useAuth } from '@/hooks/use-auth';
import {
    getEmergencyContact,
    saveEmergencyContact,
} from '@/services/emergency-contact';

export default function ContactoEmergenciaScreen() {
  const router = useRouter();
  const { selectedPatient, sessionMode } = useAppState();
  const { user: authUser } = useAuth();

  const patientId =
    sessionMode === 'backend'
      ? authUser?.roles.includes('paciente')
        ? authUser.id
        : selectedPatient?.id ?? null
      : selectedPatient?.id ?? null;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadContact() {
      setLoading(true);
      setName('');
      setPhone('');

      try {
        const contact = patientId
          ? await getEmergencyContact(patientId)
          : null;

        if (active && contact) {
          setName(contact.name);
          setPhone(contact.phone);
        }
      } catch {
        if (active) {
          Alert.alert(
            'Error',
            'No se pudo cargar el contacto de emergencia.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadContact();

    return () => {
      active = false;
    };
  }, [patientId]);

  const handleSave = async () => {
    if (!patientId) {
      Alert.alert('Sin paciente', 'No hay un paciente seleccionado.');
      return;
    }

    setSaving(true);

    try {
      await saveEmergencyContact(patientId, { name, phone });
      Alert.alert('Contacto guardado', 'El contacto de emergencia se guardó correctamente.', [
        { text: 'Aceptar', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Inténtalo nuevamente.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Contacto de emergencia</ThemedText>

      <ThemedText>
        Registra a una persona de confianza para llamarla cuando necesites ayuda.
      </ThemedText>

      {loading ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.form}>
          <ThemedText>Nombre</ThemedText>
          <TextInput
            accessibilityLabel="Nombre del contacto"
            autoCapitalize="words"
            placeholder="Ej.: María Pérez"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />

          <ThemedText>Teléfono</ThemedText>
          <TextInput
            accessibilityLabel="Teléfono del contacto"
            keyboardType="phone-pad"
            placeholder="Ej.: +56912345678"
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
          />

          <Pressable
            accessibilityRole="button"
            disabled={saving || !patientId}
            onPress={handleSave}
            style={[styles.button, (saving || !patientId) && styles.disabled]}
          >
            <ThemedText style={styles.buttonText}>
              {saving ? 'Guardando...' : 'Guardar contacto'}
            </ThemedText>
          </Pressable>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  form: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
    color: '#111',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#1565C0',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});
