import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { register as registerWithBackend } from '@/src/modules/identity/infrastructure/identity-api';
import { buildRegistrationRequest, registrationErrorMessage } from '@/src/modules/identity/application/registration';
import { Colors } from '@/src/shared/presentation/theme';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';
import { Action, Copy, Field, FlowPage } from '@/src/shared/presentation/components/flow-ui';

type RegisterRole = 'paciente' | 'cuidador';

/** Registro exclusivo del backend. No crea cuentas ni pacientes locales. */
export function AccountForm() {
  const router = useRouter();
  const theme = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const submittingRef = useRef(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [role, setRole] = useState<RegisterRole>('paciente');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (submittingRef.current || registered) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const request = buildRegistrationRequest({
        fullName: name, email, password, confirmation: confirm,
        role: role === 'paciente' ? 'PATIENT' : 'CAREGIVER',
        birthDate, privacyAccepted,
      });
      await registerWithBackend(request);
      setPassword(''); setConfirm(''); setRegistered(true);
    } catch (cause) {
      setError(registrationErrorMessage(cause));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (registered) return (
    <FlowPage title="Cuenta creada" subtitle="Tu registro fue confirmado por el servidor.">
      <Copy>Ya puedes iniciar sesión con tu correo y contraseña.</Copy>
      <Action label="Ir a iniciar sesión" onPress={() => router.replace('/(auth)/login')} />
    </FlowPage>
  );

  return (
    <FlowPage title="Crear cuenta" subtitle="Tus datos se registrarán en Domicilia mediante el servidor.">
      <View pointerEvents={submitting ? 'none' : 'auto'} style={{ gap: 16 }}>
        <Field label="Nombre completo" icon="account-outline" value={name} onChangeText={setName}
          autoComplete="name" autoCapitalize="words" placeholder="Nombre y apellido" />
        <Field label="Correo electrónico" icon="email-outline" value={email} onChangeText={setEmail}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
          autoComplete="email" placeholder="ejemplo@correo.com" />
        <Field label="Contraseña" icon="lock-outline" value={password} onChangeText={setPassword}
          secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false}
          autoComplete="new-password" secureVisible={visible}
          onToggleSecure={() => setVisible(value => !value)} />
        <Field label="Repite la contraseña" icon="lock-check-outline" value={confirm}
          onChangeText={setConfirm} secureTextEntry={!visible} autoCapitalize="none"
          autoCorrect={false} secureVisible={visible}
          onToggleSecure={() => setVisible(value => !value)} />
        <Copy>Tipo de cuenta</Copy>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(['paciente', 'cuidador'] as const).map(value => (
            <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: role === value }}
              onPress={() => setRole(value)}
              style={{ flex: 1, padding: 14, alignItems: 'center', borderWidth: 2,
                borderColor: role === value ? theme.primary : theme.border, borderRadius: 10,
                backgroundColor: role === value ? theme.primarySoft : theme.surface }}>
              <Text style={{ color: theme.text, fontWeight: '700' }}>{value === 'paciente' ? 'Paciente' : 'Cuidador'}</Text>
            </Pressable>
          ))}
        </View>
        {role === 'paciente' && (
          <Field label="Fecha de nacimiento (DD/MM/AAAA)" icon="calendar-outline"
            value={birthDate} onChangeText={setBirthDate} placeholder="15/01/2000"
            maxLength={10} keyboardType="numbers-and-punctuation" autoCorrect={false} />
        )}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: privacyAccepted }}
          onPress={() => setPrivacyAccepted(value => !value)} style={{ paddingVertical: 10, flexDirection: 'row', gap: 10 }}>
          <Text style={{ color: theme.primary }}>{privacyAccepted ? '☑' : '☐'}</Text>
          <Copy>Acepto la Política de Privacidad y el tratamiento de mis datos personales.</Copy>
        </Pressable>
        {!!error && <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text>}
        <Action label={submitting ? 'Creando cuenta…' : 'Crear cuenta'} disabled={submitting}
          onPress={() => void submit()} />
        <Action secondary label="Volver a iniciar sesión" onPress={() => router.replace('/(auth)/login')} />
      </View>
    </FlowPage>
  );
}
