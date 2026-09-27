import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Share, Switch, View } from 'react-native';
import { Action, Card, Copy, FlowPage } from '@/components/flow-ui';
import { useDemo } from '@/hooks/use-demo';
import { demo, type Permissions, type Relation } from '@/services/demo-store';
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
  const router = useRouter(); const { user, relations, invitations } = useDemo(); const [showQr, setShowQr] = useState(false); const [error, setError] = useState('');
  const invitation = invitations.find((i) => i.patientId === user?.patientId);
  const links = relations.filter((r) => r.patientId === user?.patientId && ['pending', 'approved'].includes(r.status));
  const url = invitation ? Linking.createURL('/invitacion', { queryParams: { token: invitation.token } }) : '';
  return <FlowPage title="Vínculos" subtitle="Tú decides quién te acompaña y qué puede hacer.">
    <Action secondary label="Volver al inicio" onPress={() => router.replace('/(tabs)')} />
    {user?.role === 'patient' ? <><Card><Copy>Invitar cuidador</Copy><Copy>Comparte una invitación temporal. Tendrás que aprobar cada solicitud antes de dar acceso.</Copy><Action label={invitation ? 'Generar nueva invitación' : 'Invitar cuidador'} onPress={() => { demo.invite(); setShowQr(false); }} />{invitation && <><Copy>Código: {invitation.token}</Copy><Copy>Vence: {new Date(invitation.expires).toLocaleString('es-CL')}. Generar otra invalida la anterior.</Copy><Copy>{url}</Copy><Action label="Compartir enlace" onPress={() => { void Share.share({ message: `Te invito a acompañarme en Domicilia: ${url}` }).catch(() => setError('No se pudo compartir. Puedes copiar el enlace mostrado.')); }} /><Action secondary label="Mostrar código QR (simulación)" onPress={() => setShowQr(!showQr)} />{showQr && <><MaterialCommunityIcons name="qrcode" size={130} color="#0F4C81" /><Copy>QR ilustrativo de {invitation.token}. Usa el lector simulado en esta misma app; no es escaneable con una cámara.</Copy></>}<Action secondary label="Continuar como familiar (demostración)" onPress={() => { demo.remember(invitation.token); demo.logout(); router.replace({ pathname: '/invitacion', params: { token: invitation.token } }); }} /></>}</Card><Copy>Solicitudes y cuidadores ({links.length})</Copy>{links.length === 0 && <Copy>Aún no hay solicitudes ni cuidadores autorizados.</Copy>}{links.map((r) => <RequestCard key={r.id} relation={r} />)}</> : <><Copy>Consulta tus pacientes aprobados o solicita otro vínculo.</Copy><Action label="Mis pacientes y solicitudes" onPress={() => router.push('/(auth)/select-patient')} /></>}
    {!!error && <Copy>{error}</Copy>}
  </FlowPage>;
}
