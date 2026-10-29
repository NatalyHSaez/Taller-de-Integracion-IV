import { useEffect, useRef, useState } from 'react';
import { Share, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Action, Card, Copy, FlowPage } from '@/components/flow-ui';
import { useAppState } from '@/hooks/use-app-state';
import { apiClient } from '@/services/api';
import { dataClient } from '@/services/data';
import { getApiErrorMessage } from '@/services/errors';
import type { CaregiverPermissionCode, LinkCodeResponse, LinkedUserResponse } from '@/types/api';

const CODES: { code: CaregiverPermissionCode; title: string }[] = [
  { code: 'PATIENT_PROFILE_VIEW', title: 'Ver ficha del paciente' },
  { code: 'MEASUREMENT_CREATE', title: 'Registrar mediciones' },
  { code: 'MEASUREMENT_VIEW', title: 'Ver historial y gráficos' },
  { code: 'ALERT_VIEW', title: 'Ver alertas clínicas' },
];

function Caregiver({ record, changed }: {
  record: LinkedUserResponse; changed: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<CaregiverPermissionCode[]>(() =>
    CODES.map((item) => item.code).filter((code) => record.permissions.includes(code)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try {
      await apiClient.put(`/caregiver-relationships/${record.relationshipId}/permissions`, { permissions: selected });
      dataClient.clearCache();
      await changed();
    } catch (cause) { setError(getApiErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function revoke() {
    setBusy(true); setError('');
    try {
      await apiClient.delete(`/caregiver-relationships/${record.relationshipId}`);
      dataClient.clearCache();
      await changed();
    } catch (cause) { setError(getApiErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <Card>
    <Copy>{record.fullName}</Copy>
    {CODES.map(({ code, title }) => <View key={code} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Switch accessibilityLabel={title} value={selected.includes(code)} disabled={busy}
        onValueChange={(enabled) => setSelected((old) => enabled ? [...old, code] : old.filter((item) => item !== code))} />
      <View style={{ flex: 1 }}><Copy>{title}</Copy></View>
    </View>)}
    <Action label={busy ? 'Guardando…' : 'Guardar permisos'} disabled={busy} onPress={() => void save()} />
    <Action label="Revocar acceso" secondary disabled={busy} onPress={() => void revoke()} />
    {!!error && <Copy>{error}</Copy>}
  </Card>;
}

type UserRole = 'patient' | 'caregiver' | undefined;

/** Una única consulta que usan tanto la carga inicial como la actualización manual. */
async function fetchLinkedUsers(patientId: string) {
  const [caregivers, doctors] = await Promise.all([
    apiClient.get<LinkedUserResponse[]>(`/patients/${patientId}/caregivers`),
    apiClient.get<LinkedUserResponse[]>(`/patients/${patientId}/doctors`),
  ]);
  return { caregivers, doctors };
}

function RealLinksForPatient({ patientId, role }: { patientId: string | undefined; role: UserRole }) {
  const router = useRouter();
  const [caregivers, setCaregivers] = useState<LinkedUserResponse[]>([]);
  const [doctors, setDoctors] = useState<LinkedUserResponse[]>([]);
  const [code, setCode] = useState<LinkCodeResponse | null>(null);
  const [busy, setBusy] = useState(() => Boolean(patientId && role === 'patient'));
  const [error, setError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    if (!patientId || role !== 'patient') return;
    const id = ++requestId.current;
    let active = true;

    // La carga inicial empieza en el estado «ocupado»; sus cambios de estado
    // suceden al recibir el resultado asíncrono, no dentro del efecto.
    void fetchLinkedUsers(patientId)
      .then(({ caregivers: care, doctors: docs }) => {
        if (!active || id !== requestId.current) return;
        setCaregivers(care);
        setDoctors(docs);
      })
      .catch((cause: unknown) => {
        if (!active || id !== requestId.current) return;
        setCaregivers([]);
        setDoctors([]);
        setError(getApiErrorMessage(cause));
      })
      .finally(() => {
        if (active && id === requestId.current) setBusy(false);
      });

    return () => { active = false; };
  }, [patientId, role]);

  async function load() {
    if (!patientId || role !== 'patient') return;
    const id = ++requestId.current;
    setBusy(true);
    setError('');
    try {
      const { caregivers: care, doctors: docs } = await fetchLinkedUsers(patientId);
      if (id !== requestId.current) return;
      setCaregivers(care);
      setDoctors(docs);
    } catch (cause) {
      if (id !== requestId.current) return;
      setCaregivers([]);
      setDoctors([]);
      setError(getApiErrorMessage(cause));
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  async function generateCode() {
    if (!patientId) return;
    setBusy(true); setError('');
    try {
      const result = await apiClient.post<LinkCodeResponse>(`/patients/${patientId}/link-codes`, { type: 'CAREGIVER' });
      setCode(result);
    } catch (cause) { setError(getApiErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <FlowPage title="Vínculos reales" subtitle="Los permisos y códigos se administran mediante el backend.">
    <Action secondary label="Volver al inicio" onPress={() => router.replace('/(tabs)')} />
    {role === 'caregiver' ? <>
      <Copy>Los pacientes disponibles y sus permisos aparecen en «Mis pacientes».</Copy>
      <Action label="Mis pacientes" onPress={() => router.push('/(auth)/select-patient')} />
      <Action secondary label="Ingresar un código" onPress={() => router.push('/invitacion')} />
    </> : <>
      <Action label={busy ? 'Consultando…' : 'Actualizar vinculaciones'} disabled={busy} onPress={() => void load()} />
      <Card><Copy>Generar código de cuidador (válido 5 minutos, un solo uso).</Copy>
        <Action label="Generar código real" disabled={busy} onPress={() => void generateCode()} />
        {code && <><Copy>Código: {code.code}</Copy><Copy>Vence: {new Date(code.expiresAt).toLocaleString('es-CL')}</Copy>
          <Action secondary label="Compartir código" onPress={() => void Share.share({ message: `Código de vinculación Domicilia: ${code.code}` }).catch(() => setError('No se pudo compartir el código.'))} />
        </>}
      </Card>
      <Copy>Cuidadores activos: {caregivers.length}</Copy>
      {caregivers.map((record) => <Caregiver key={record.relationshipId} record={record} changed={load} />)}
      <Copy>Médicos vinculados: {doctors.length}</Copy>
      {doctors.map((record) => <Card key={record.relationshipId}><Copy>{record.fullName}</Copy></Card>)}
    </>}
    {!!error && <Card><Copy>{error}</Copy></Card>}
  </FlowPage>;
}


/** El cambio de paciente/cuenta remonta la vista y descarta listas y códigos anteriores. */
export function RealLinks() {
  const { user, selectedPatient, sessionMode } = useAppState();
  return <RealLinksForPatient
    key={`${sessionMode ?? 'none'}:${user?.id ?? 'anon'}:${selectedPatient?.id ?? 'sin-paciente'}:${user?.role ?? 'sin-rol'}`}
    patientId={selectedPatient?.id}
    role={user?.role}
  />;
}
