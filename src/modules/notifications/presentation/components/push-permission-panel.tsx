import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { getPushPermission, requestPushPermission } from '../../application/use-cases/push-permissions';
import { canRequestPushPermission, type PushPermission } from '../../domain/push-permission';
import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import type { AppTheme } from '@/src/shared/presentation/theme';

function describe(permission: PushPermission): string {
  switch (permission.status) {
    case 'unsupported': return permission.reason === 'expo-go'
      ? 'La prueba de permisos push requiere una compilación propia de desarrollo, no Expo Go.'
      : 'Las notificaciones push móviles no están disponibles en esta plataforma.';
    case 'granted': return 'Permiso del sistema concedido.';
    case 'provisional': return 'Permiso provisional: el sistema puede entregar avisos silenciosamente.';
    case 'ephemeral': return 'Permiso temporal del sistema.';
    case 'undetermined': return 'Todavía no se ha solicitado el permiso.';
    case 'denied': return permission.canAskAgain
      ? 'Permiso no concedido. Puedes volver a solicitarlo.'
      : 'Permiso bloqueado. Puedes modificarlo en los ajustes del sistema.';
  }
}

export function PushPermissionPanel({ theme }: { theme: AppTheme }) {
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function run(request: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    try {
      const result = await (request ? requestPushPermission() : getPushPermission());
      if (mounted.current) setPermission(result);
    } catch {
      if (mounted.current) { setPermission(null); setError(true); }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <View style={[styles.panel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <ThemedText type="defaultSemiBold">Permisos de avisos del teléfono</ThemedText>
      <ThemedText style={[styles.small, { color: theme.mutedText }]}>Preparación de push: todavía no se registran dispositivos ni se envían avisos remotos.</ThemedText>
      <ThemedText style={styles.small}>
        {permission ? describe(permission) : 'Consulta el permiso de este dispositivo.'}
      </ThemedText>
      {error && <ThemedText accessibilityRole="alert" style={[styles.small, { color: theme.danger }]}>No se pudo consultar o solicitar el permiso. Comprueba la compilación de la app y vuelve a intentar.</ThemedText>}
      {busy && <ActivityIndicator color={theme.primary} />}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void run(false)}>
        <ThemedText style={{ color: theme.primary }}>Consultar permiso</ThemedText>
      </Pressable>
      {permission && canRequestPushPermission(permission) && (
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void run(true)}>
          <ThemedText style={{ color: theme.primary }}>Solicitar permiso</ThemedText>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({ panel: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 }, small: { fontSize: 13, lineHeight: 19 } });
