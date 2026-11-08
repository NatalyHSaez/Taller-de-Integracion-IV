import { useAppStateContext } from '@/src/core/presentation/session/app-state-context';

/**
 * Acceso reactivo al usuario autenticado y al paciente seleccionado.
 * El estado es compartido por toda la aplicación desde el Root Layout.
 */
export function useAppState() {
  return useAppStateContext();
}
