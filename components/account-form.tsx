import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Action, Card, Copy, Field, FlowPage } from './flow-ui';
import { demo } from '@/services/demo-store';
import { useDemo } from '@/hooks/use-demo';
export function AccountForm({ mode }: { mode: 'login' | 'activate' | 'register' }) {
  const router = useRouter(); const { pendingToken } = useDemo();
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState(''); const [error, setError] = useState(''); const [visible, setVisible] = useState(false);
  function submit() {
    try {
      if (mode !== 'login' && password !== confirm) throw new Error('Las contraseñas no coinciden.');
      if (mode === 'login') demo.login(email, password);
      else if (mode === 'activate') demo.activate(code, email, password);
      else demo.registerCaregiver(name, email, password);
      router.replace(demo.snapshot().pendingToken && demo.user()?.role === 'caregiver' ? '/invitacion' : demo.patient() ? '/(tabs)' : '/(auth)/select-patient');
    } catch (e) { setError((e as Error).message); }
  }
  return <FlowPage title={mode === 'login' ? 'Bienvenido a Domicilia' : mode === 'activate' ? 'Activa tu cuenta de paciente' : 'Crea tu cuenta de cuidador'} subtitle={mode === 'activate' ? 'Usa la invitación del centro y el correo registrado por tu doctor.' : mode === 'register' ? 'El paciente debe aprobar tu solicitud antes de compartir sus datos.' : 'Ingresa con tu correo y contraseña.'}>
    {pendingToken && <Card><Copy>Tienes una invitación pendiente. La retomaremos al identificarte como cuidador.</Copy></Card>}
    {mode === 'register' && <Field label="Nombre completo" value={name} onChangeText={setName} autoComplete="name" />}
    {mode === 'activate' && <Field label="Código de invitación del centro" value={code} onChangeText={setCode} autoCapitalize="characters" />}
    <Field label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
    <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
    {mode !== 'login' && <><Copy>Usa al menos 8 caracteres.</Copy><Field label="Repite la contraseña" value={confirm} onChangeText={setConfirm} secureTextEntry={!visible} autoCapitalize="none" /></>}
    <Action secondary label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onPress={() => setVisible(!visible)} />
    {!!error && <Copy>{error}</Copy>}
    <Action label={mode === 'login' ? 'Iniciar sesión' : mode === 'activate' ? 'Activar cuenta' : 'Crear cuenta de cuidador'} onPress={submit} />
    {mode === 'login' ? <><Action secondary label="Activar cuenta de paciente" onPress={() => router.push('/(auth)/activate')} /><Action secondary label="Crear cuenta de cuidador" onPress={() => router.push('/(auth)/register')} /><Action secondary label="Probar recorrido de demostración" onPress={() => router.push('/demo')} /></> : <Action secondary label="Volver a iniciar sesión" onPress={() => router.replace('/(auth)/login')} />}
    <Copy>Demostración local: usa datos ficticios. Las cuentas y vínculos se conservan al cerrar sesión y se reinician al recargar la app.</Copy>
  </FlowPage>;
}
