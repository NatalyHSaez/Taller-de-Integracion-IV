import { authService } from '@/src/modules/identity/application/authservice';
import { useAppState } from '@/src/core/presentation/session/use-app-state';
import { useDemo } from '@/src/modules/demo/presentation/use-demo';
import { createPatientLinkCode, getPatientCaregivers, getPatientDoctors, type LinkCodeResponse, type LinkedUserResponse } from '@/src/modules/relationships/infrastructure/relationships-api';
import { demo, type Permissions, type Relation } from '@/src/modules/demo/infrastructure/demo-store';
import { formatLinkedAt, shortRelationshipId } from '@/src/modules/relationships/presentation/link-format';
import { DoctorLinkCodeCard } from '@/src/modules/relationships/presentation/components/doctor-link-code-card';
import {
  Divider,
  EmptyState,
  LinkButton,
  LinkCodeDisplay,
  LinksHero,
  Loading,
  MetaRow,
  Notice,
  Panel,
  PanelHeader,
  Paragraph,
  PermissionChips,
  PermissionToggle,
  PERMISSION_ICONS,
  PersonHeader,
  SectionHeader,
  useLinksTheme,
  type IconName,
} from '@/src/modules/relationships/presentation/components/links-ui';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Linking from 'expo-linking';
import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
// Agregado: mismas funciones con manejo de errores del vínculo y un Alert que también funciona en la web.
import { Alert } from '@/src/modules/relationships/presentation/confirm-dialog';
import { onStaleRelationship, revokeCaregiverRelationship, revokeDoctorRelationship, updateCaregiverPermissions } from '@/src/modules/relationships/application/relationship-actions';
const DEMO_PERMISSIONS: { key: keyof Permissions; label: string; icon: IconName }[] = [
  { key: 'alerts', label: 'Recibir alertas', icon: 'bell-alert-outline' },
  { key: 'read', label: 'Consultar mediciones', icon: 'chart-line' },
  { key: 'write', label: 'Ayudar a registrar mediciones', icon: 'pencil-plus-outline' },
];

function RequestCard({ relation }: { relation: Relation }) {
  const { accounts } = useDemo(); const [permissions, setPermissions] = useState<Permissions>({ alerts: true, read: true, write: false });
  const [error, setError] = useState('');
  const account = accounts.find((a) => a.id === relation.caregiverId);
  const decide = (status: Relation['status']) => { try { demo.decide(relation.id, status, permissions); } catch (e) { setError((e as Error).message); } };
  const pending = relation.status === 'pending';
  const granted = [relation.permissions.alerts && 'ALERT_VIEW', relation.permissions.read && 'MEASUREMENT_VIEW', relation.permissions.write && 'MEASUREMENT_CREATE'].filter(Boolean) as string[];
  return <Panel>
    <PersonHeader name={account?.name ?? 'Cuidador'} email={account?.email} role="caregiver"
      badge={pending ? { label: 'Pendiente', tone: 'pending' } : { label: 'Aprobado', tone: 'approved' }} />
    {pending ? <>
      <Notice tone="info" text="Solicita acompañarte. Revisa su identidad y los permisos antes de aceptar." />
      <View>{DEMO_PERMISSIONS.map(({ key, label, icon }) => (
        <PermissionToggle key={key} icon={icon} label={label} value={permissions[key]}
          onChange={(value) => setPermissions({ ...permissions, [key]: value })} />
      ))}</View>
      <LinkButton icon="check" label="Aceptar vínculo con estos permisos" onPress={() => decide('approved')} />
      <LinkButton variant="secondary" icon="close" label="Rechazar solicitud" onPress={() => decide('rejected')} />
    </> : <>
      <PermissionChips codes={granted} />
      <LinkButton variant="danger" icon="account-remove-outline" label="Retirar acceso" onPress={() => decide('revoked')} />
    </>}
    {!!error && <Notice tone="error" text={error} />}
  </Panel>;
}

const CAREGIVER_PERMISSIONS = [
  { code: 'PATIENT_PROFILE_VIEW', label: 'Ver perfil del paciente' },
  { code: 'MEASUREMENT_CREATE', label: 'Registrar mediciones' },
  { code: 'MEASUREMENT_VIEW', label: 'Consultar mediciones' },
  { code: 'ALERT_VIEW', label: 'Consultar alertas' },
] as const;

/** Agregado: fecha de vinculación, permisos e identificador real del vínculo. */
function LinkDetails({ link }: { link: LinkedUserResponse }) {
  return <View style={styles.details}>
    <MetaRow icon="calendar-check-outline">Vinculado el {formatLinkedAt(link.linkedAt) ?? 'fecha no informada'}</MetaRow>
    <MetaRow icon="link-variant">Vínculo {shortRelationshipId(link.relationshipId)}</MetaRow>
  </View>;
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
  return <Panel>
    <PersonHeader name={caregiver.fullName} role="caregiver" />
    <LinkDetails link={caregiver} />
    <Divider />
    <Paragraph muted>Qué puede hacer</Paragraph>
    <View>
      {CAREGIVER_PERMISSIONS.map(({ code, label }) => (
        <PermissionToggle
          key={code}
          icon={PERMISSION_ICONS[code]}
          label={label}
          disabled={busy}
          value={selected.includes(code)}
          onChange={enabled => setSelected(current => enabled
            ? (current.includes(code) ? current : [...current, code])
            : current.filter(item => item !== code))}
        />
      ))}
    </View>
    {changed && <LinkButton icon="content-save-outline" busy={busy} label={busy ? 'Guardando...' : 'Guardar permisos'} onPress={() => { if (!busy) void save(); }} />}
    <LinkButton variant="danger" icon="account-remove-outline" disabled={busy} label={busy ? 'Procesando...' : 'Retirar acceso del cuidador'} onPress={() => { if (!busy) confirmRevoke(); }} />
    {!!message && <Notice tone={message === 'Permisos actualizados.' ? 'success' : 'error'} text={message} />}
  </Panel>;
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
  return <Panel>
    <PersonHeader name={doctor.fullName} role="doctor" />
    <LinkDetails link={doctor} />
    <PermissionChips codes={doctor.permissions} />
    <LinkButton variant="danger" icon="account-remove-outline" disabled={busy} label={busy ? 'Procesando...' : 'Retirar acceso del médico'} onPress={() => { if (!busy) confirmRevoke(); }} />
    {!!message && <Notice tone="error" text={message} />}
  </Panel>;
}

export default function Links() {
  const router = useRouter(); const { user, selectedPatient, sessionMode } = useAppState(); const { relations, invitations } = useDemo(); const [showQr, setShowQr] = useState(false); const [error, setError] = useState('');
  const [realLinkCode, setRealLinkCode] =
    useState<LinkCodeResponse | null>(null);

  const [generatingCode, setGeneratingCode] = useState(false);
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
  
  const { theme } = useLinksTheme();
  const isPatient = user?.role === 'patient';
  const subtitle = isPatient
    ? 'Decide quién te acompaña y qué puede ver de tu salud.'
    : 'Conéctate con los pacientes que acompañas.';
  const realStats = sessionMode === 'backend' && isPatient
    ? [
        { icon: 'account-heart-outline' as const, label: loadingLinks ? 'Cuidadores…' : `${caregivers.length} ${caregivers.length === 1 ? 'cuidador' : 'cuidadores'}` },
        { icon: 'stethoscope' as const, label: loadingLinks ? 'Médicos…' : `${doctors.length} ${doctors.length === 1 ? 'médico' : 'médicos'}` },
      ]
    : undefined;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <LinksHero
          subtitle={subtitle}
          stats={realStats}
          onRefresh={sessionMode === 'backend' && isPatient ? () => { void manualRefreshLinks(); } : undefined}
          refreshing={refreshingLinks}
          refreshDisabled={loadingLinks || refreshingLinks}
        />

      {sessionMode === 'backend' ? (
        user?.role === 'patient' ? (
          <>
            {!!linksError && !loadingLinks && !refreshingLinks && (
              <Notice
                tone="error"
                text={linksError}
                action={<LinkButton variant="secondary" icon="refresh" label="Reintentar" onPress={() => { void manualRefreshLinks(); }} />}
              />
            )}

            <SectionHeader title="Cuidadores" count={loadingLinks ? undefined : caregivers.length} />
            {loadingLinks ? (
              <Loading text="Cargando cuidadores..." />
            ) : linksError ? null : caregivers.length === 0 ? (
              <EmptyState icon="account-heart-outline" title="Sin cuidadores vinculados" text="Invita a un familiar o cuidador con un código temporal." />
            ) : (
              caregivers.map((caregiver) => (
                <RealCaregiverCard key={caregiver.relationshipId} caregiver={caregiver}
                  onChanged={refreshRealLinks} />
              ))
            )}

            <SectionHeader title="Médicos" count={loadingLinks ? undefined : doctors.length} />
            {loadingLinks ? (
              <Loading text="Cargando médicos..." />
            ) : linksError ? null : doctors.length === 0 ? (
              <EmptyState icon="stethoscope" title="Sin médicos vinculados" text="Tu médico puede vincularse con el código para médicos." />
            ) : (
              doctors.map((doctor) => (
                <RealDoctorCard key={doctor.relationshipId} doctor={doctor}
                  onChanged={refreshRealLinks} />
              ))
            )}

            <SectionHeader title="Invitar" />
            <Panel>
              <PanelHeader
                icon="account-plus-outline"
                title="Invitar cuidador"
                description="Genera un código temporal para que un cuidador se vincule a tu cuenta. Dura 5 minutos y solo puede usarse una vez."
              />

              {realLinkCode && (
                /* Agregado: cuenta regresiva; al vencer se ocultan el código y el QR. */
                <LinkCodeDisplay
                  code={realLinkCode.code}
                  expiresAt={realLinkCode.expiresAt}
                  onExpired={() => {
                    setRealLinkCode(null);
                    setError('El código venció. Genera uno nuevo.');
                  }}
                  qrHint="Escanea este QR desde la cuenta del cuidador. Contiene el mismo código temporal de un solo uso."
                  shareMessage={
                    `Código de vinculación Domicilia: ${realLinkCode.code}\n` +
                    'Abre Domicilia e introduce este código para vincularte.'
                  }
                  onShareError={() => setError('No fue posible compartir el código.')}
                />
              )}

              <LinkButton
                variant={realLinkCode ? 'secondary' : 'primary'}
                icon={realLinkCode ? 'refresh' : 'key-plus'}
                busy={generatingCode}
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
            </Panel>
            {/* Agregado: código para vincular a un médico (tipo DOCTOR). */}
            {!!user?.id && <DoctorLinkCodeCard patientId={user.id} />}
          </>
        ) : (
          <Panel>
            <PanelHeader
              icon="qrcode-scan"
              title="Vincularte con un paciente"
              description="Para vincularte con un paciente, introduce el código que te haya proporcionado o escanea su QR."
            />
            <LinkButton
              icon="keyboard-outline"
              label="Introducir código"
              onPress={() => router.push('/invitacion')}
            />
          </Panel>
        )
      ) : (
        user?.role === 'patient' ? (
          <>
            <Panel>
              <PanelHeader
                icon="account-plus-outline"
                title="Invitar cuidador (demostración)"
                description="Comparte una invitación temporal. Tendrás que aprobar cada solicitud antes de dar acceso."
              />

              {invitation && (
                <>
                  <View style={[styles.demoCode, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                    <Paragraph muted>Código</Paragraph>
                    <Paragraph>{invitation.token}</Paragraph>
                    <MetaRow icon="timer-sand">Vence: {new Date(invitation.expires).toLocaleString('es-CL')}</MetaRow>
                    <MetaRow icon="link-variant">{url}</MetaRow>
                  </View>

                  <LinkButton
                    icon="share-variant-outline"
                    label="Compartir enlace"
                    onPress={() => {
                      void Share.share({
                        message: `Te invito a acompañarme en Domicilia: ${url}`,
                      }).catch(() =>
                        setError('No se pudo compartir el enlace.')
                      );
                    }}
                  />

                  <LinkButton
                    variant="secondary"
                    icon="qrcode"
                    label="Mostrar código QR (simulación)"
                    onPress={() => setShowQr(!showQr)}
                  />

                  {showQr && (
                    <View style={styles.demoQr}>
                      <MaterialCommunityIcons
                        name="qrcode"
                        size={130}
                        color={theme.primary}
                      />
                      <Paragraph muted>
                        QR ilustrativo de {invitation.token}.
                        No es escaneable con una cámara.
                      </Paragraph>
                    </View>
                  )}

                  <LinkButton
                    variant="secondary"
                    icon="account-switch-outline"
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

              <LinkButton
                variant={invitation ? 'secondary' : 'primary'}
                icon={invitation ? 'refresh' : 'account-plus-outline'}
                label={invitation ? 'Generar nueva invitación' : 'Invitar cuidador'}
                onPress={() => {
                  demo.invite();
                  setShowQr(false);
                }}
              />
            </Panel>

            <SectionHeader title="Solicitudes y cuidadores" count={links.length} />

            {links.length === 0 && (
              <EmptyState icon="account-clock-outline" title="Nada por ahora" text="Aún no hay solicitudes ni cuidadores autorizados." />
            )}

            {links.map((relation) => (
              <RequestCard key={relation.id} relation={relation} />
            ))}
          </>
        ) : (
          <Panel>
            <PanelHeader
              icon="account-group-outline"
              title="Tus pacientes"
              description="Consulta tus pacientes aprobados o solicita otro vínculo."
            />
            <LinkButton
              icon="arrow-right"
              label="Mis pacientes y solicitudes"
              onPress={() => router.push('/(auth)/select-patient')}
            />
          </Panel>
        )
      )}

        {!!error && <Notice tone="error" text={error} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 14, paddingBottom: 36, paddingHorizontal: 16, paddingTop: 12 },
  details: { gap: 4 },
  demoCode: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 4, padding: 14 },
  demoQr: { alignItems: 'center', gap: 6 },
});
