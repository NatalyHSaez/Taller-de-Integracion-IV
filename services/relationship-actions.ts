import { Alert as NativeAlert, Platform, type AlertButton } from 'react-native';

import {
  getMePatients,
  revokeCaregiverRelationship as apiRevokeCaregiverRelationship,
  revokeDoctorRelationship as apiRevokeDoctorRelationship,
  updateCaregiverPermissions as apiUpdateCaregiverPermissions,
  type LinkedUserResponse,
} from './api';
import { ApiError, normalizeApiError } from './errors';

/**
 * Operaciones sobre vínculos con manejo de errores del backend:
 *   PUT    /api/v1/caregiver-relationships/{relationshipId}/permissions
 *   DELETE /api/v1/caregiver-relationships/{relationshipId}
 *   DELETE /api/v1/doctor-relationships/{relationshipId}
 *
 * Mismas firmas que las funciones de services/api.ts, para usarlas sin
 * cambiar las pantallas. Agregan:
 * - Mensajes claros para RELATIONSHIP_NOT_FOUND, RELATIONSHIP_REVOKED y
 *   UNKNOWN_PERMISSION.
 * - Revocar un vínculo que ya no existe o ya estaba revocado cuenta como
 *   logrado (el objetivo era quitarlo), así la pantalla recarga y desaparece.
 * - Si al guardar permisos el vínculo ya no existe, se avisa a quien escuche
 *   (onStaleRelationship) para recargar la lista.
 * - El DELETE responde 204 sin cuerpo: services/api.ts no intenta leer JSON.
 */

export const CAREGIVER_PERMISSION_CODES = [
  'PATIENT_PROFILE_VIEW',
  'MEASUREMENT_CREATE',
  'MEASUREMENT_VIEW',
  'ALERT_VIEW',
] as const;

export type RelationshipErrorInfo = {
  code: string;
  status?: number;
  message: string;
  /** El vínculo ya no está activo en el backend: hay que recargar la lista. */
  stale: boolean;
};

export function describeRelationshipError(error: unknown): RelationshipErrorInfo {
  const apiError = normalizeApiError(error);
  const { code, status } = apiError;
  if (code === 'RELATIONSHIP_NOT_FOUND' || status === 404) {
    return { code: 'RELATIONSHIP_NOT_FOUND', status, message: 'Este vínculo ya no existe. Se actualizó la lista.', stale: true };
  }
  if (code === 'RELATIONSHIP_REVOKED' || status === 409) {
    return { code: 'RELATIONSHIP_REVOKED', status, message: 'Este vínculo ya estaba revocado. Se actualizó la lista.', stale: true };
  }
  if (code === 'UNKNOWN_PERMISSION' || status === 422) {
    return {
      code: 'UNKNOWN_PERMISSION',
      status,
      message: 'Uno de los permisos no es válido. Revisa la selección e inténtalo nuevamente.',
      stale: false,
    };
  }
  if (status === 401) {
    return { code, status, message: 'Tu sesión expiró. Vuelve a iniciar sesión.', stale: false };
  }
  if (status === 403) {
    return { code, status, message: 'No tienes permiso para modificar este vínculo.', stale: false };
  }
  return { code, status, message: 'No se pudo completar la operación. Verifica tu conexión e inténtalo nuevamente.', stale: false };
}

const staleListeners = new Set<() => void>();

/** Avisa cuando una operación descubre que un vínculo ya no está activo. */
export function onStaleRelationship(listener: () => void): () => void {
  staleListeners.add(listener);
  return () => {
    staleListeners.delete(listener);
  };
}

function friendlyError(info: RelationshipErrorInfo): ApiError {
  return new ApiError({ code: info.code, status: info.status, message: info.message });
}

/** PUT reemplaza: se envía siempre el conjunto completo (sin repetidos). */
export async function updateCaregiverPermissions(
  relationshipId: string,
  permissions: string[],
): Promise<LinkedUserResponse> {
  const complete = Array.from(new Set(permissions));
  try {
    return await apiUpdateCaregiverPermissions(relationshipId, complete);
  } catch (error) {
    const info = describeRelationshipError(error);
    if (info.stale) staleListeners.forEach((listener) => listener());
    throw friendlyError(info);
  }
}

async function revoke(call: () => Promise<void>): Promise<void> {
  try {
    await call(); // 204 No Content
  } catch (error) {
    const info = describeRelationshipError(error);
    if (info.stale) return; // Ya no estaba activo: el resultado es el buscado.
    throw friendlyError(info);
  }
}

export function revokeCaregiverRelationship(relationshipId: string): Promise<void> {
  return revoke(() => apiRevokeCaregiverRelationship(relationshipId));
}

export function revokeDoctorRelationship(relationshipId: string): Promise<void> {
  return revoke(() => apiRevokeDoctorRelationship(relationshipId));
}

/**
 * El cuidador deja de acompañar a un paciente: busca su vínculo vigente
 * (GET /me/patients) y lo revoca. Si ya no existe, no hay nada que hacer.
 */
export async function leaveCaregiverRelationship(patientId: string): Promise<void> {
  let mine;
  try {
    mine = await getMePatients();
  } catch (error) {
    throw friendlyError(describeRelationshipError(error));
  }
  const relation = mine.find(
    (item) => item.patientId === patientId && item.relationshipType === 'CAREGIVER',
  );
  if (!relation) return;
  await revokeCaregiverRelationship(relation.relationshipId);
}

/**
 * Alert que también funciona en la web. En react-native-web Alert.alert no
 * muestra nada; aquí se usa el diálogo del navegador (confirm/alert).
 * En el celular es el Alert nativo, sin cambios.
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: Parameters<typeof NativeAlert.alert>[3]) {
    if (Platform.OS !== 'web') {
      NativeAlert.alert(title, message, buttons, options);
      return;
    }
    const text = message ? `${title}\n\n${message}` : title;
    const list = buttons ?? [];
    if (list.length >= 2) {
      const cancel = list.find((button) => button.style === 'cancel');
      const action = list.find((button) => button !== cancel) ?? list[list.length - 1];
      const accepted = typeof window !== 'undefined' && typeof window.confirm === 'function' && window.confirm(text);
      (accepted ? action : cancel)?.onPress?.();
      return;
    }
    if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(text);
    list[0]?.onPress?.();
  },
};

/** Confirmación como promesa: true solo si se elige la acción. Cancelar o cerrar: false. */
export function confirmAction(input: { title: string; message: string; confirmLabel: string }): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      input.title,
      input.message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: input.confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
