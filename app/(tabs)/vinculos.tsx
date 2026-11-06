import { authService } from '@/services/authservice';
import { Action, Card, Copy, FlowPage } from '@/components/flow-ui';
import { useAppState } from '@/hooks/use-app-state';
import { useDemo } from '@/hooks/use-demo';
import {
  createPatientLinkCode,
  getPatientCaregivers,
  getPatientDoctors,
  type LinkCodeResponse,
  type LinkedUserResponse,
} from '@/services/api';
import { demo, type Permissions, type Relation } from '@/services/demo-store';
import { describePermissions, formatLinkedAt, shortRelationshipId } from '@/services/patient-links';
import { DoctorLinkCodeCard } from '@/components/relationships/doctor-link-code-card';
import { LinkCodeCountdown } from '@/components/relationships/link-code-countdown';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Linking from 'expo-linking';
import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Share, Switch, View } from 'react-native';
// Agregado: mismas funciones con manejo de errores del vínculo y un Alert que también funciona en la web.
import {
  Alert,
  onStaleRelationship,
  revokeCaregiverRelationship,
  revokeDoctorRelationship,
  updateCaregiverPermissions,
} from '@/services/relationship-actions';
import QRCode from 'react-native-qrcode-svg';
function RequestCard({ relation }: { relation: Relation }) {
  const { accounts } = useDemo(); const [permissions, setPermissions] = useState<Permissions>({ alerts: true, read: true, write: false });
  const [error, setError] = useState('');
  const account = accounts.find((a) => a.id === relation.caregiverId);
  const decide = (status: Relation['status']) => { try { demo.decide(relation.id, status, permissions); } catch (e) { setError((e as Error).message); } };
  return <Card><Copy>{account?.name}</Copy><Copy>{account?.email}</Copy><Copy>{relation.status === 'pending' ? 'Solicita acompañarte. Revisa su identidad y los permisos antes de aceptar.' : 'Vínculo aprobado'}</Copy>
    {relation.status === 'pending' ? <>{(['alerts', 'read', 'write'] as const).map((key) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Switch accessibilityLabel={{ alerts: 'Recibir alertas', read: 'Consultar mediciones', write: 'Registrar mediciones' }[key]} value={permissions[key]} onValueChange={(value) => setPermissions({ ...permissions, [key]: value })} /><View style={{ flex: 1 }}><Copy>{{ alerts: 'Recibir alertas', read: 'Consultar mediciones', write: 'Ayudar a registrar mediciones' }[key]}</Copy></View></View>)}<Action label="Aceptar vínculo con estos permisos" onPress={() => decide('approved')} /><Action secondary label="Rechazar solicitud" onPress={() => decide('rejected')} /></> : <><Copy>Permisos: {[relation.permissions.alerts && 'alertas', relation.permissions.read && 'consultar mediciones', relation.permissions.write && 'registrar mediciones'].filter(Boolean).join(', ') || 'ninguno'}.</Copy><Action secondary label="Retirar acceso" onPress={() => decide('revoked')} /></>}
    {!!error && <Copy>{error}</Copy>}
  </Card>;
}

const CAREGIVER_PERMISSIONS = [
  { code: 'PATIENT_PROFILE_VIEW', label: 'Ver perfil del paciente' },
  { code: 'MEASUREMENT_CREATE', label: 'Registrar mediciones' },
  { code: 'MEASUREMENT_VIEW', label: 'Consultar mediciones' },
  { code: 'ALERT_VIEW', label: 'Consultar alertas' },
] as const;

/** Agregado: fecha de vinculación, permisos e identificador real del vínculo. */
function LinkDetails({ link }: { link: LinkedUserResponse }) {
  return <>
    <Copy>Vinculado el {formatLinkedAt(link.linkedAt) ?? 'fecha no informada'}.</Copy>
    <Copy>Permisos: {describePermissions(link.permissions)}.</Copy>
    <Copy>Vínculo: {shortRelationshipId(link.relationshipId)}</Copy>
  </>;
}

function RealCaregiverCard({ caregiver, onChanged }: {
  caregiver: LinkedUserResponse;
  onChanged: () => Promise<void>;
}) {
  // Mostrar todos los permisos permitidos por el backend, incluso los desactivados.
  const [selected, setSelected] = useState<string[]>(caregiver.permissions);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { setSelected(caregiver.permissions); }, [caregiver.permissions.join('|')]);
  const changed = selected.length !== caregiver.permissions.length ||
    selected.some(permission => !caregiver.permissions.includes(permission));

  async function save() {
    setBusy(true); setMessage('');
    try {
      await updateCaregiverPermissions(caregiver.relationshipId, selected);
      await onChanged();
      setMessage('Permisos actualizados.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudieron guardar los permisos.');
    } finally { setBusy(false); }
  }
  function confirmRevoke() {
    Alert.alert('Retirar acceso', `¿Quieres revocar el acceso de ${caregiver.fullName}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Revocar acceso', style: 'destructive', onPress: () => { void (async () => {
        setBusy(true); setMessage('');
        try { await revokeCaregiverRelationship(caregiver.relationshipId); await onChanged(); }
        catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No se pudo revocar el vínculo.'); }
        finally { setBusy(false); }
      })(); } },
    ]);
  }
  return <View style={{ gap: 8, marginTop: 12 }}>
    <Copy>{caregiver.fullName}</Copy>
    <LinkDetails link={caregiver} />
    {CAREGIVER_PERMISSIONS.map(({ code, label }) => (
      <View key={code} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Switch
          accessibilityLabel={label}
          disabled={busy}
          value={selected.includes(code)}
          onValueChange={enabled => setSelected(current => enabled
            ? (current.includes(code) ? current : [...current, code])
            : current.filter(item => item !== code))}
        />
        <View style={{ flex: 1 }}><Copy>{label}</Copy></View>
      </View>
    ))}
    {changed && <Action label={busy ? 'Guardando...' : 'Guardar permisos'} onPress={() => { if (!busy) void save(); }} />}
    <Action secondary label={busy ? 'Procesando...' : 'Retirar acceso del cuidador'} onPress={() => { if (!busy) confirmRevoke(); }} />
    {!!message && <Copy>{message}</Copy>}
  </View>;
}

function RealDoctorCard({ doctor, onChanged }: {
  doctor: LinkedUserResponse;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  function confirmRevoke() {
    Alert.alert('Retirar acceso', `¿Quieres revocar el acceso de ${doctor.fullName}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Revocar acceso', style: 'destructive', onPress: () => { void (async () => {
        setBusy(true); setMessage('');
        try { await revokeDoctorRelationship(doctor.relationshipId); await onChanged(); }
        catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No se pudo revocar el vínculo.'); }
        finally { setBusy(false); }
      })(); } },
    ]);
  }
  return <View style={{ gap: 8, marginTop: 12 }}>
    <Copy>{doctor.fullName}</Copy>
    <LinkDetails link={doctor} />
    <Action secondary label={busy ? 'Procesando...' : 'Retirar acceso del médico'} onPress={() => { if (!busy) confirmRevoke(); }} />
    {!!message && <Copy>{message}</Copy>}
  </View>;
}

export default function Links() {
  const router = useRouter(); const { user, selectedPatient, sessionMode } = useAppState(); const { relations, invitations } = useDemo(); const [showQr, setShowQr] = useState(false); const [error, setError] = useState('');
  const [realLinkCode, setRealLinkCode] =
    useState<LinkCodeResponse | null>(null);

  const [generatingCode, setGeneratingCode] = useState(false);
  const [showRealQr, setShowRealQr] = useState(false);
  const patientId = sessionMode === 'backend' && user?.role === 'patient' ? user.id : null;
  const [caregivers, setCaregivers] = useState<LinkedUserResponse[]>([]);
  const [doctors, setDoctors] = useState<LinkedUserResponse[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [linksError, setLinksError] = useState('');
  async function refreshRealLinks() {
    if (!patientId) return;
    const [nextCaregivers, nextDoctors] = await Promise.all([
      getPatientCaregivers(patientId), getPatientDoctors(patientId),
    ]);
    setCaregivers(nextCaregivers);
    setDoctors(nextDoctors);
  }


  useEffect(() => {
    let cancelled = false;
    setCaregivers([]);
    setDoctors([]);
    setLinksError('');
    if (!patientId) {
      setLoadingLinks(false);
      return;
    }
    setLoadingLinks(true);
    Promise.all([getPatientCaregivers(patientId), getPatientDoctors(patientId)])
      .then(([nextCaregivers, nextDoctors]) => {
        if (!cancelled) {
          setCaregivers(nextCaregivers);
          setDoctors(nextDoctors);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setLinksError(cause instanceof Error ? cause.message : 'No fue posible consultar las vinculaciones.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLinks(false);
      });
    return () => { cancelled = true; };
  }, [patientId]);

  // Agregado: actualización manual (botón "Actualizar vínculos" y "Reintentar").
  const [refreshingLinks, setRefreshingLinks] = useState(false);
  async function manualRefreshLinks() {
    if (!patientId) return;
    setRefreshingLinks(true);
    setLinksError('');
    try {
      await refreshRealLinks();
    } catch (cause) {
      setLinksError(cause instanceof Error ? cause.message : 'No fue posible consultar las vinculaciones.');
    } finally {
      setRefreshingLinks(false);
    }
  }
  // Agregado: al volver a la pestaña se actualiza (la primera carga la hace el efecto de arriba),
  // así aparece el cuidador que acaba de usar el código.
  const isFocused = useIsFocused();
  const refreshOnFocus = useEffectEvent(() => { void manualRefreshLinks(); });
  const firstFocus = useRef(true);
  useEffect(() => {
    if (!isFocused) return;
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    refreshOnFocus();
  }, [isFocused]);
  // Agregado: si al guardar permisos el vínculo ya no existe, se recarga la lista.
  useEffect(() => onStaleRelationship(() => refreshOnFocus()), []);
  const invitation = invitations.find((i) => i.patientId === selectedPatient?.id);
  async function generateRealLinkCode() {
    if (
      sessionMode !== 'backend' ||
      user?.role !== 'patient' ||
      !user.id
    ) {
      setError('Debes iniciar sesión como paciente.');
      return;
    }

    setError('');
    setRealLinkCode(null);
    setShowRealQr(false);
    setGeneratingCode(true);

    try {
      const result = await createPatientLinkCode(
        user.id,
        'CAREGIVER'
      );

      setRealLinkCode(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No fue posible generar el código.'
      );
    } finally {
      setGeneratingCode(false);
    }
  }
  const links = relations.filter((r) => r.patientId === selectedPatient?.id && ['pending', 'approved'].includes(r.status));
  const url = invitation ? Linking.createURL('/invitacion', { queryParams: { token: invitation.token } }) : '';
  
  return (
    <FlowPage
      title="Vínculos"
      subtitle="Gestiona las personas que pueden acompañarte."
    >
      <Action
        secondary
        label="Volver al inicio"
        onPress={() => router.replace('/(tabs)')}
      />

      {sessionMode === 'backend' ? (
        user?.role === 'patient' ? (
          <>
            <Action
              secondary
              disabled={loadingLinks || refreshingLinks}
              label={refreshingLinks ? 'Actualizando vínculos...' : 'Actualizar vínculos'}
              onPress={() => { void manualRefreshLinks(); }}
            />
            {!!linksError && !loadingLinks && !refreshingLinks && (
              <Action label="Reintentar" onPress={() => { void manualRefreshLinks(); }} />
            )}

            <Card>
              <Copy>Cuidadores vinculados ({caregivers.length})</Copy>

              {loadingLinks ? (
                <Copy>Cargando cuidadores...</Copy>
              ) : linksError ? (
                <Copy>{linksError}</Copy>
              ) : caregivers.length === 0 ? (
                <Copy>No tienes cuidadores vinculados.</Copy>
              ) : (
                caregivers.map((caregiver) => (
                  <RealCaregiverCard key={caregiver.relationshipId} caregiver={caregiver}
                    onChanged={refreshRealLinks} />
                ))
              )}
            </Card>

            <Card>
              <Copy>Médicos vinculados ({doctors.length})</Copy>

              {loadingLinks ? (
                <Copy>Cargando médicos...</Copy>
              ) : linksError ? (
                <Copy>{linksError}</Copy>
              ) : doctors.length === 0 ? (
                <Copy>No tienes médicos vinculados.</Copy>
              ) : (
                doctors.map((doctor) => (
                  <RealDoctorCard key={doctor.relationshipId} doctor={doctor}
                    onChanged={refreshRealLinks} />
                ))
              )}
            </Card>
          <Card>
            <Copy>Invitar cuidador</Copy>
            <Copy>
              Genera un código temporal para que un cuidador
              pueda vincularse a tu cuenta.
              El código dura 5 minutos y solo puede usarse una vez.
            </Copy>

            <Action
              label={
                generatingCode
                  ? 'Generando código...'
                  : realLinkCode
                    ? 'Generar nuevo código'
                    : 'Generar código de vinculación'
              }
              onPress={() => {
                if (!generatingCode) {
                  void generateRealLinkCode();
                }
              }}
            />

            {realLinkCode && (
              <>
                <Copy>Código: {realLinkCode.code}</Copy>
                <Copy>
                  Vence: {new Date(realLinkCode.expiresAt).toLocaleString('es-CL')}
                </Copy>
                {/* Agregado: cuenta regresiva; al vencer se ocultan el código y el QR. */}
                <LinkCodeCountdown
                  expiresAt={realLinkCode.expiresAt}
                  onExpired={() => {
                    setRealLinkCode(null);
                    setShowRealQr(false);
                    setError('El código venció. Genera uno nuevo.');
                  }}
                />

                <Action
                  secondary
                  label={showRealQr ? 'Ocultar QR' : 'Mostrar QR escaneable'}
                  onPress={() => setShowRealQr((previous) => !previous)}
                />
                {showRealQr && (
                  <View style={{ alignItems: 'center', paddingVertical: 12, gap: 8 }}>
                    <View style={{ padding: 14, backgroundColor: '#FFFFFF' }}>
                      <QRCode value={realLinkCode.code} size={220} />
                    </View>
                    <Copy>Escanea este QR desde la cuenta del cuidador o médico.</Copy>
                    <Copy>El QR contiene el mismo código temporal de un solo uso.</Copy>
                  </View>
                )}

                <Action
                  label="Compartir código"
                  onPress={() => {
                    void Share.share({
                      message:
                        `Código de vinculación Domicilia: ${realLinkCode.code}\n` +
                        'Abre Domicilia e introduce este código para vincularte.',
                    }).catch(() =>
                      setError('No fue posible compartir el código.')
                    );
                  }}
                />
              </>
            )}
          </Card>
          {/* Agregado: código para vincular a un médico (tipo DOCTOR). */}
          {!!user?.id && <DoctorLinkCodeCard patientId={user.id} />}
          </>
        ) : (
          <Card>
            <Copy>
              Para vincularte con un paciente, introduce el código
              que te haya proporcionado.
            </Copy>
            <Action
              label="Introducir código"
              onPress={() => router.push('/invitacion')}
            />
          </Card>
        )
      ) : (
        user?.role === 'patient' ? (
          <>
            <Card>
              <Copy>Invitar cuidador (demostración)</Copy>
              <Copy>
                Comparte una invitación temporal.
                Tendrás que aprobar cada solicitud antes de dar acceso.
              </Copy>

              <Action
                label={invitation ? 'Generar nueva invitación' : 'Invitar cuidador'}
                onPress={() => {
                  demo.invite();
                  setShowQr(false);
                }}
              />

              {invitation && (
                <>
                  <Copy>Código: {invitation.token}</Copy>
                  <Copy>
                    Vence: {new Date(invitation.expires).toLocaleString('es-CL')}
                  </Copy>
                  <Copy>{url}</Copy>

                  <Action
                    label="Compartir enlace"
                    onPress={() => {
                      void Share.share({
                        message: `Te invito a acompañarme en Domicilia: ${url}`,
                      }).catch(() =>
                        setError('No se pudo compartir el enlace.')
                      );
                    }}
                  />

                  <Action
                    secondary
                    label="Mostrar código QR (simulación)"
                    onPress={() => setShowQr(!showQr)}
                  />

                  {showQr && (
                    <>
                      <MaterialCommunityIcons
                        name="qrcode"
                        size={130}
                        color="#0F4C81"
                      />
                      <Copy>
                        QR ilustrativo de {invitation.token}.
                        No es escaneable con una cámara.
                      </Copy>
                    </>
                  )}

                  <Action
                    secondary
                    label="Continuar como familiar (demostración)"
                    onPress={() => {
                      const token = invitation.token;
                      demo.remember(token);
                      // Cierra la sesión completa (tokens, caché y estado), como en la versión de Sebastian.
                      void authService
                        .logout()
                        .then(() =>
                          router.replace({ pathname: '/invitacion', params: { token } }),
                        )
                        .catch(() => setError('No se pudo cerrar la sesion. Intenta nuevamente.'));
                    }}
                  />
                </>
              )}
            </Card>

            <Copy>Solicitudes y cuidadores ({links.length})</Copy>

            {links.length === 0 && (
              <Copy>Aún no hay solicitudes ni cuidadores autorizados.</Copy>
            )}

            {links.map((relation) => (
              <RequestCard key={relation.id} relation={relation} />
            ))}
          </>
        ) : (
          <>
            <Copy>
              Consulta tus pacientes aprobados o solicita otro vínculo.
            </Copy>
            <Action
              label="Mis pacientes y solicitudes"
              onPress={() => router.push('/(auth)/select-patient')}
            />
          </>
        )
      )}

      {!!error && <Copy>{error}</Copy>}
    </FlowPage>
  );

}
