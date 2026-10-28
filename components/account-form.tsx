
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDemo } from '@/hooks/use-demo';
import { register as registerWithBackend } from '@/services/api';
import { demo } from '@/services/demo-store';

import {
  Action,
  Card,
  Copy,
  Field,
  FlowPage,
} from './flow-ui';

type RegisterRole = 'paciente' | 'cuidador';

function validarFechaNacimiento(valor: string): string {
  const fecha = valor.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error(
      'La fecha debe tener el formato AAAA-MM-DD. Ejemplo: 1998-05-21.',
    );
  }

  const [anio, mes, dia] = fecha.split('-').map(Number);
  const fechaUTC = new Date(Date.UTC(anio, mes - 1, dia));

  if (
    fechaUTC.getUTCFullYear() !== anio ||
    fechaUTC.getUTCMonth() !== mes - 1 ||
    fechaUTC.getUTCDate() !== dia
  ) {
    throw new Error('Ingresa una fecha de nacimiento válida.');
  }

  const hoy = new Date();
  const hoyUTC = Date.UTC(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate(),
  );

  if (fechaUTC.getTime() > hoyUTC) {
    throw new Error(
      'La fecha de nacimiento no puede ser futura.',
    );
  }

  return fecha;
}

export function AccountForm({
  mode,
}: {
  mode: 'login' | 'activate' | 'register';
}) {
  const router = useRouter();
  const { pendingToken } = useDemo();
  const theme = Colors[
    useColorScheme() === 'dark' ? 'dark' : 'light'
  ];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');

  const [birthDate, setBirthDate] = useState('');
  const [role, setRole] = useState<RegisterRole>('paciente');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function validateRegister() {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 3) {
      throw new Error(
        'Ingresa un nombre completo de al menos 3 caracteres.',
      );
    }

    if (cleanName.length > 200) {
      throw new Error(
        'El nombre no puede superar los 200 caracteres.',
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error(
        'Ingresa un correo electrónico válido.',
      );
    }

    if (password.length < 8 || password.length > 128) {
      throw new Error(
        'La contraseña debe tener entre 8 y 128 caracteres.',
      );
    }

    if (password !== confirm) {
      throw new Error('Las contraseñas no coinciden.');
    }

    let fechaNacimiento: string | undefined;

    if (role === 'paciente') {
      if (!birthDate.trim()) {
        throw new Error(
          'Ingresa la fecha de nacimiento del paciente.',
        );
      }

      fechaNacimiento = validarFechaNacimiento(birthDate);
    }

    if (!privacyAccepted) {
      throw new Error(
        'Debes aceptar la Política de Privacidad para crear tu cuenta.',
      );
    }

    return {
      cleanName,
      cleanEmail,
      fechaNacimiento,
    };
  }

  async function submit() {
    if (submitting) return;

    setError('');

    try {
      if (mode === 'register') {
        const {
          cleanName,
          cleanEmail,
          fechaNacimiento,
        } = validateRegister();

        setSubmitting(true);

        await registerWithBackend({
          nombre_completo: cleanName,
          correo: cleanEmail,
          password,
          rol: role,
          ...(fechaNacimiento
            ? { fecha_nacimiento: fechaNacimiento }
            : {}),
        });

        Alert.alert(
          'Cuenta creada',
          'Tu cuenta fue creada correctamente. Ahora puedes iniciar sesión.',
          [
            {
              text: 'Continuar',
              onPress: () => {
                router.replace('/(auth)/login');
              },
            },
          ],
        );

        return;
      }

      // Conservar el flujo de login demostrativo.
      if (mode === 'login') {
        demo.login(email, password);

        router.replace(
          demo.snapshot().pendingToken &&
            demo.user()?.role === 'caregiver'
            ? '/invitacion'
            : demo.patient()
              ? '/(tabs)'
              : '/(auth)/select-patient',
        );

        return;
      }

      // Conservar el flujo de activación demostrativo.
      if (mode === 'activate') {
        if (!code.trim()) {
          throw new Error(
            'Ingresa el código de invitación.',
          );
        }

        if (!email.trim()) {
          throw new Error(
            'Ingresa tu correo electrónico.',
          );
        }

        if (password.length < 8) {
          throw new Error(
            'La contraseña debe tener al menos 8 caracteres.',
          );
        }

        if (password !== confirm) {
          throw new Error(
            'Las contraseñas no coinciden.',
          );
        }

        demo.activate(
          code.trim(),
          email.trim().toLowerCase(),
          password,
        );

        router.replace(
          demo.patient()
            ? '/(tabs)'
            : '/(auth)/select-patient',
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Ocurrió un error inesperado.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    mode === 'login'
      ? 'Bienvenido a Domicilia'
      : mode === 'activate'
        ? 'Activa tu cuenta de paciente'
        : 'Crea tu cuenta';

  const subtitle =
    mode === 'activate'
      ? 'Usa la invitación del centro y el correo registrado por tu doctor.'
      : mode === 'register'
        ? 'Completa tus datos para crear tu cuenta en Domicilia.'
        : 'Ingresa con tu correo y contraseña.';

  function roleButton(
    value: RegisterRole,
    label: string,
  ) {
    const selected = role === value;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => {
          setRole(value);
          setError('');
        }}
        style={{
          flex: 1,
          paddingHorizontal: 12,
          paddingVertical: 13,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected
            ? theme.primary
            : theme.border,
          backgroundColor: selected
            ? theme.primarySoft
            : theme.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: selected
              ? theme.primary
              : theme.mutedText,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <FlowPage title={title} subtitle={subtitle}>
      {pendingToken && mode !== 'register' && (
        <Card>
          <Copy>
            Tienes una invitación pendiente.
            La retomaremos al identificarte como cuidador.
          </Copy>
        </Card>
      )}

      {mode === 'register' && (
        <Field
          label="Nombre completo"
          icon="account-outline"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          autoCapitalize="words"
          placeholder="Nombre y apellido"
        />
      )}

      {mode === 'activate' && (
        <Field
          label="Código de invitación del centro"
          icon="ticket-confirmation-outline"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="Código de invitación"
        />
      )}

      <Field
        label="Correo electrónico"
        icon="email-outline"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        placeholder="ejemplo@correo.com"
      />

      <Field
        label="Contraseña"
        icon="lock-outline"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={
          mode === 'login'
            ? 'current-password'
            : 'new-password'
        }
        placeholder="••••••••"
        secureVisible={visible}
        onToggleSecure={() =>
          setVisible((current) => !current)
        }
      />

      {mode !== 'login' && (
        <>
          <Copy>
            Usa al menos 8 caracteres.
          </Copy>

          <Field
            label="Repite la contraseña"
            icon="lock-check-outline"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="••••••••"
            secureVisible={visible}
            onToggleSecure={() =>
              setVisible((current) => !current)
            }
          />
        </>
      )}

      {mode === 'register' && (
        <>
          <View style={{ gap: 8 }}>
            <Copy>Tipo de cuenta</Copy>

            <View
              style={{
                flexDirection: 'row',
                gap: 10,
              }}
            >
              {roleButton('paciente', 'Paciente')}
              {roleButton('cuidador', 'Cuidador')}
            </View>
          </View>

          {role === 'paciente' && (
            <View style={{ gap: 6 }}>
              <Field
                label="Fecha de nacimiento"
                icon="calendar-outline"
                value={birthDate}
                onChangeText={setBirthDate}
                placeholder="AAAA-MM-DD"
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Copy>
                Ejemplo: 1998-05-21. Este dato es
                obligatorio para pacientes.
              </Copy>
            </View>
          )}

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: privacyAccepted,
            }}
            onPress={() =>
              setPrivacyAccepted(
                (current) => !current,
              )
            }
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
              paddingVertical: 8,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                borderWidth: 2,
                borderColor: privacyAccepted
                  ? theme.primary
                  : theme.border,
                backgroundColor: privacyAccepted
                  ? theme.primary
                  : theme.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {privacyAccepted && (
                <Text
                  style={{
                    color: theme.onPrimary,
                    fontSize: 14,
                    fontWeight: '900',
                  }}
                >
                  ✓
                </Text>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Copy>
                He leído y acepto la Política
                de Privacidad y el tratamiento
                de mis datos personales.
              </Copy>
            </View>
          </Pressable>
        </>
      )}

      {!!error && (
        <View
          style={{
            backgroundColor: theme.dangerBackground,
            borderColor: theme.dangerBorder,
            borderRadius: 14,
            borderWidth: 1,
            padding: 13,
          }}
        >
          <Text
            style={{
              color: theme.danger,
              fontSize: 13,
              lineHeight: 19,
            }}
          >
            {error}
          </Text>
        </View>
      )}

      <Action
        label={
          submitting
            ? mode === 'activate'
              ? 'Activando cuenta...'
              : mode === 'login'
                ? 'Iniciando sesión...'
                : 'Creando cuenta...'
            : mode === 'login'
              ? 'Iniciar sesión'
              : mode === 'activate'
                ? 'Activar cuenta'
                : 'Crear cuenta'
        }
        disabled={submitting}
        onPress={submit}
      />

      {mode === 'login' ? (
        <>
          <Action
            secondary
            label="Activar cuenta de paciente"
            onPress={() =>
              router.push('/(auth)/activate')
            }
          />

          <Action
            secondary
            label="Crear una cuenta"
            onPress={() =>
              router.push('/(auth)/register')
            }
          />

          <Action
            secondary
            label="Probar recorrido de demostración"
            onPress={() => router.push('/demo')}
          />
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.replace('/(auth)/login')
          }
          style={({ pressed }) => [
            styles.backLink,
            pressed && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            color={theme.primary}
            name="arrow-left"
            size={18}
          />
          <Text
            style={[
              styles.backLinkText,
              { color: theme.primary },
            ]}
          >
            Volver a iniciar sesión
          </Text>
        </Pressable>
      )}

      {mode !== 'register' && (
        <Copy>
          Demostración local: usa datos ficticios.
          Las cuentas y vínculos se conservan al
          cerrar sesión y se reinician al recargar
          la app.
        </Copy>
      )}
    </FlowPage>
  );
}

const styles = StyleSheet.create({
  backLink: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  backLinkText: {
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
