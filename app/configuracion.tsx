import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { Action, Card, Copy, Field, FlowPage } from '@/components/flow-ui';
import { useDemo } from '@/hooks/use-demo';
import { demo } from '@/services/demo-store';

function EditarCorreo() {
  const { user } = useDemo();
  const [email, setEmail] = useState(user?.email ?? '');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const guardar = () => {
    try {
      demo.updateEmail(email);
      setMensaje('Correo actualizado.');
      setError('');
    } catch (e) {
      setError((e as Error).message);
      setMensaje('');
    }
  };

  return (
    <Card>
      <Copy>Correo electrónico</Copy>
      <Field
        label="Correo"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      {!!error && <Copy>{error}</Copy>}
      {!!mensaje && <Copy>{mensaje}</Copy>}
      <Action label="Guardar correo" onPress={guardar} />
    </Card>
  );
}

function CambiarContrasena() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const guardar = () => {
    try {
      if (nueva !== repetir) throw new Error('Las contraseñas nuevas no coinciden.');
      demo.updatePassword(actual, nueva);
      setMensaje('Contraseña actualizada.');
      setError('');
      setActual('');
      setNueva('');
      setRepetir('');
    } catch (e) {
      setError((e as Error).message);
      setMensaje('');
    }
  };

  return (
    <Card>
      <Copy>Cambiar contraseña</Copy>
      <Field label="Contraseña actual" value={actual} onChangeText={setActual} secureTextEntry />
      <Field label="Contraseña nueva" value={nueva} onChangeText={setNueva} secureTextEntry />
      <Field label="Repite la contraseña nueva" value={repetir} onChangeText={setRepetir} secureTextEntry />
      {!!error && <Copy>{error}</Copy>}
      {!!mensaje && <Copy>{mensaje}</Copy>}
      <Action label="Guardar contraseña" onPress={guardar} />
    </Card>
  );
}

export default function Configuracion() {
  const router = useRouter();
  const { notificationPrefs, vozActiva, vozVolumen } = useDemo();
  const [editandoCredenciales, setEditandoCredenciales] = useState(false);
  const [mostrarAyuda, setMostrarAyuda] = useState(false);
  const [mostrarAcercaDe, setMostrarAcercaDe] = useState(false);

  return (
    <FlowPage title="Configuración" subtitle="Administra tu cuenta y tus notificaciones.">
      <Copy>Notificaciones</Copy>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Switch
            accessibilityLabel="Mediciones guardadas"
            value={notificationPrefs.mediciones}
            onValueChange={(value) => demo.setNotificationPrefs({ mediciones: value })}
          />
          <View style={{ flex: 1 }}>
            <Copy>Mediciones guardadas</Copy>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Switch
            accessibilityLabel="Vínculos y permisos"
            value={notificationPrefs.vinculos}
            onValueChange={(value) => demo.setNotificationPrefs({ vinculos: value })}
          />
          <View style={{ flex: 1 }}>
            <Copy>Vínculos y permisos (solicitudes, aprobaciones, revocaciones)</Copy>
          </View>
        </View>
      </Card>

      <Copy>Accesibilidad</Copy>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Switch
            accessibilityLabel="Leer en voz alta al guardar mediciones"
            value={vozActiva}
            onValueChange={(value) => demo.setVozActiva(value)}
          />
          <View style={{ flex: 1 }}>
            <Copy>Leer en voz alta al guardar mediciones</Copy>
          </View>
        </View>
        {vozActiva && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { label: 'Baja', valor: 0.3 },
              { label: 'Media', valor: 0.6 },
              { label: 'Alta', valor: 1 },
            ].map((opcion) => (
              <View key={opcion.label} style={{ flex: 1 }}>
                <Action
                  secondary={vozVolumen !== opcion.valor}
                  label={opcion.label}
                  onPress={() => demo.setVozVolumen(opcion.valor)}
                />
              </View>
            ))}
          </View>
        )}
      </Card>

      <Copy>Cuenta</Copy>
      <Card>
        <Action
          secondary
          label={editandoCredenciales ? 'Ocultar datos de inicio de sesión' : 'Cambiar datos de inicio de sesión'}
          onPress={() => setEditandoCredenciales(!editandoCredenciales)}
        />
      </Card>
      {editandoCredenciales && (
        <>
          <EditarCorreo />
          <CambiarContrasena />
        </>
      )}

      <Copy>Privacidad y datos</Copy>
      <Card>
        <Copy>
          Esta es una demostración local: tus datos viven solo en la memoria de tu dispositivo
          mientras usas la app, y se reinician al recargarla. No se envían a ningún servidor.
        </Copy>
      </Card>

      <Copy>Ayuda y soporte</Copy>
      <Card>
        <Action
          secondary
          label={mostrarAyuda ? 'Ocultar' : '¿Cómo funciona Domicilia?'}
          onPress={() => setMostrarAyuda(!mostrarAyuda)}
        />
        {mostrarAyuda && (
          <Copy>
            Domicilia te ayuda a llevar el registro de tu salud y compartirlo con las personas que
            tú elijas. Invita a un cuidador o médico desde Vínculos, y decide tú qué puede ver o
            hacer cada uno.
          </Copy>
        )}
      </Card>

      <Copy>Acerca de</Copy>
      <Card>
        <Action
          secondary
          label={mostrarAcercaDe ? 'Ocultar' : 'Acerca de Domicilia'}
          onPress={() => setMostrarAcercaDe(!mostrarAcercaDe)}
        />
        {mostrarAcercaDe && (
          <>
            <Copy>Domicilia — versión de demostración académica.</Copy>
            <Copy>Taller de Integración IV.</Copy>
          </>
        )}
      </Card>

      <Action
        secondary
        label="Cerrar sesión"
        onPress={() => {
          demo.logout();
          router.replace('/(auth)/login');
        }}
      />
    </FlowPage>
  );
}