
import AsyncStorage from '@react-native-async-storage/async-storage';

export type EmergencyContact = {
  name: string;
  phone: string;
};

const getStorageKey = (patientId: string) =>
  `domicilia:emergency-contact:${patientId}`;

export async function saveEmergencyContact(
  patientId: string,
  contact: EmergencyContact
): Promise<void> {
  const name = contact.name.trim();
  const phone = contact.phone.trim();

  if (!patientId.trim()) {
    throw new Error('No se ha identificado al paciente.');
  }

  if (!name || !/^\+?[0-9]{7,15}$/.test(phone)) {
    throw new Error('Ingresa un nombre y un teléfono válido.');
  }

  await AsyncStorage.setItem(
    getStorageKey(patientId),
    JSON.stringify({ name, phone })
  );
}

export async function getEmergencyContact(
  patientId: string
): Promise<EmergencyContact | null> {
  if (!patientId.trim()) {
    return null;
  }

  const stored = await AsyncStorage.getItem(getStorageKey(patientId));

  if (!stored) {
    return null;
  }

  try {
    const contact: unknown = JSON.parse(stored);

    if (
      typeof contact === 'object' &&
      contact !== null &&
      'name' in contact &&
      'phone' in contact &&
      typeof contact.name === 'string' &&
      typeof contact.phone === 'string'
    ) {
      return {
        name: contact.name,
        phone: contact.phone,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function deleteEmergencyContact(
  patientId: string
): Promise<void> {
  if (!patientId.trim()) {
    return;
  }

  await AsyncStorage.removeItem(getStorageKey(patientId));
}
