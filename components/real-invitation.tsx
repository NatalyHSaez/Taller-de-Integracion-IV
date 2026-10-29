import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Action, Card, Copy, Field, FlowPage } from '@/components/flow-ui';
import { useAppState } from '@/hooks/use-app-state';
import { apiClient } from '@/services/api';
import { patientAccess } from '@/services/patient-access';
import { getApiErrorMessage } from '@/services/errors';
import type { RelationshipResponse } from '@/types/api';

export function RealInvitation() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const { user } = useAppState();
  const [code, setCode] = useState(params.token ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RelationshipResponse | null>(null);
  async function consume() {
    if (!user || user.role !== 'caregiver') return;
    setBusy(true); setError('');
    try {
      // El código QR del backend contiene solo seis caracteres; no hay lectura de cámara en P5.
      const normalized = code.includes('token=') ?
        decodeURIComponent(code.split('token=')[1].split('&')[0]) : code;
      const relationship = await apiClient.post<RelationshipResponse>('/link-codes/consume', { code: normalized.trim() });
      setResult(relationship);
      await patientAccess.refresh();
    } catch (cause) { setError(getApiErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <FlowPage title="Vincular paciente" subtitle="Ingresa el código temporal que muestra el paciente.">
    {!user ? <>
      <Copy>Debes iniciar sesión como cuidador para utilizar el código.</Copy>
      <Action label="Iniciar sesión" onPress={() => router.push('/(auth)/login')} />
    </> : user.role !== 'caregiver' ? <Copy>Esta opción está disponible para cuentas de cuidador.</Copy> : <>
      <Field label="Código de 6 caracteres" value={code} onChangeText={setCode} autoCapitalize="characters" />
      <Action label={busy ? 'Vinculando…' : 'Vincular con el backend'} disabled={busy || !code.trim()}
        onPress={() => void consume()} />
      {result && <Card><Copy>Vínculo activo con {result.patientName}.</Copy>
        <Action label="Elegir paciente" onPress={() => router.replace('/(auth)/select-patient')} />
      </Card>}
      {!!error && <Card><Copy>{error}</Copy></Card>}
      <Copy>El lector de cámara/QR aún no está integrado; puedes introducir el código manualmente.</Copy>
    </>}
    <Action secondary label="Volver" onPress={() => router.replace(user ? '/(auth)/select-patient' : '/(auth)/login')} />
  </FlowPage>;
}
