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
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, Switch, View } from 'react-native';
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
                  <View key={caregiver.relationshipId}>
                    <Copy>{caregiver.fullName}</Copy>
                    <Copy>
                      Permisos: {caregiver.permissions.join(', ') || 'Ninguno'}
                    </Copy>
                  </View>
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
                  <View key={doctor.relationshipId}>
                    <Copy>{doctor.fullName}</Copy>
                  </View>
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
                      demo.remember(invitation.token);
                      demo.logout();
                      router.replace({
                        pathname: '/invitacion',
                        params: { token: invitation.token },
                      });
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
