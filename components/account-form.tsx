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
import { authService } from '@/services/authservice';
import { demo } from '@/services/demo-store';

import {
  Action,
  Card,
  Copy,
  Field,
  FlowPage,
} from './flow-ui';

type RegisterRole = 'paciente' | 'cuidador';

export function AccountForm({
  mode,
}: {
  mode: 'login' | 'activate' | 'register';
}) {
  const router = useRouter();
  const { pendingToken } = useDemo();
  const theme = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  /*
   * Campos generales.
   */
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  /*
   * Campo utilizado por el flujo antiguo de activación.
   */
  const [code, setCode] = useState('');

  /*
   * Estado de interfaz.
   */
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /*
   * Campos específicos del registro real.
   */
  const [role, setRole] =
    useState<RegisterRole>('paciente');

  const [privacyAccepted, setPrivacyAccepted] =
    useState(false);

  /**
   * Validación del formulario de registro.
   */
  function validateRegister() {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      throw new Error(
        'Ingresa tu nombre completo.'
      );
    }

    if (cleanName.length < 3) {
      throw new Error(
        'El nombre debe tener al menos 3 caracteres.'
      );
    }

    if (!cleanEmail) {
      throw new Error(
        'Ingresa tu correo electrónico.'
      );
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      throw new Error(
        'Ingresa un correo electrónico válido.'
      );
    }

    if (!password) {
      throw new Error(
        'Ingresa una contraseña.'
      );
    }

    if (password.length < 8) {
      throw new Error(
        'La contraseña debe tener al menos 8 caracteres.'
      );
    }

    if (password !== confirm) {
      throw new Error(
        'Las contraseñas no coinciden.'
      );
    }

    if (!privacyAccepted) {
      throw new Error(
        'Debes aceptar la Política de Privacidad para crear tu cuenta.'
      );
    }

    return {
      cleanName,
      cleanEmail,
    };
  }

  /**
   * Envío principal del formulario.
   */
  async function submit() {
    if (submitting) {
      return;
    }

    setError('');

    try {
      /*
       * ============================
       * REGISTRO
       * ============================
       */
      if (mode === 'register') {
        const {
          cleanName,
          cleanEmail,
        } = validateRegister();

        setSubmitting(true);

        if (role === 'cuidador') {
          await authService.register({
            name: cleanName,
            email: cleanEmail,
            password,
          });
        } else {
          await registerWithBackend({
            nombre_completo: cleanName,
            correo: cleanEmail,
            password,
            rol: role,
          });
        }

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
          ]
        );

        return;
      }

      /*
       * ============================
       * LOGIN DEMO
       * ============================
       *
       * Este bloque se conserva porque AccountForm
       * todavía es utilizado por los flujos antiguos.
       *
       * El Login real que ya probamos está implementado
       * en la pantalla correspondiente.
       */
      if (mode === 'login') {
        demo.login(email, password);

        router.replace(
          demo.snapshot().pendingToken &&
            demo.user()?.role === 'caregiver'
            ? '/invitacion'
            : demo.patient()
              ? '/(tabs)'
              : '/(auth)/select-patient'
        );

        return;
      }

      /*
       * ============================
       * ACTIVACIÓN DEMO
       * ============================
       */
      if (mode === 'activate') {
        if (!code.trim()) {
          throw new Error(
            'Ingresa el código de invitación.'
          );
        }

        if (!email.trim()) {
          throw new Error(
            'Ingresa tu correo electrónico.'
          );
        }

        if (password.length < 8) {
          throw new Error(
            'La contraseña debe tener al menos 8 caracteres.'
          );
        }

        if (password !== confirm) {
          throw new Error(
            'Las contraseñas no coinciden.'
          );
        }

        demo.activate(
          code.trim(),
          email.trim().toLowerCase(),
          password
        );

        router.replace(
          demo.patient()
            ? '/(tabs)'
            : '/(auth)/select-patient'
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Ocurrió un error inesperado.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * Textos dependiendo del flujo.
   */
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

  return (
    <FlowPage
      title={title}
      subtitle={subtitle}
    >
      {pendingToken && mode !== 'register' && (
        <Card>
          <Copy>
            Tienes una invitación pendiente.
            La retomaremos al identificarte
            como cuidador.
          </Copy>
        </Card>
      )}

      {/* Nombre */}
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

      {/* Código de activación */}
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

      {/* Correo */}
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

      {/* Contraseña */}
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
        onToggleSecure={() => setVisible((current) => !current)}
      />

      {/* Confirmar contraseña */}
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
            onToggleSecure={() => setVisible((current) => !current)}
          />
        </>
      )}

      {/* ============================= */}
      {/* OPCIONES DEL REGISTRO */}
      {/* ============================= */}

      {mode === 'register' && (
        <>
          {/* Tipo de cuenta */}
          <View
            style={{
              gap: 8,
            }}
          >
            <Copy>
              Tipo de cuenta
            </Copy>

            <View
              style={{
                flexDirection: 'row',
                gap: 10,
              }}
            >
              {/* Paciente */}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  selected: role === 'paciente',
                }}
                onPress={() =>
                  setRole('paciente')
                }
                style={{
                  flex: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 13,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor:
                    role === 'paciente'
                      ? theme.primary
                      : theme.border,
                  backgroundColor:
                    role === 'paciente'
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
                    color:
                      role === 'paciente'
                        ? theme.primary
                        : theme.mutedText,
                  }}
                >
                  Paciente
                </Text>
              </Pressable>

              {/* Cuidador */}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  selected: role === 'cuidador',
                }}
                onPress={() =>
                  setRole('cuidador')
                }
                style={{
                  flex: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 13,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor:
                    role === 'cuidador'
                      ? theme.primary
                      : theme.border,
                  backgroundColor:
                    role === 'cuidador'
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
                    color:
                      role === 'cuidador'
                        ? theme.primary
                        : theme.mutedText,
                  }}
                >
                  Cuidador
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Política de privacidad */}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: privacyAccepted,
            }}
            onPress={() =>
              setPrivacyAccepted(
                (current) => !current
              )
            }
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
              paddingVertical: 8,
            }}
          >
            {/* Checkbox */}
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                borderWidth: 2,
                borderColor:
                  privacyAccepted
                    ? theme.primary
                    : theme.border,
                backgroundColor:
                  privacyAccepted
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

            <View
              style={{
                flex: 1,
              }}
            >
              <Copy>
                He leído y acepto la Política
                de Privacidad y el tratamiento
                de mis datos personales.
              </Copy>
            </View>
          </Pressable>
        </>
      )}

      {/* Mensajes de error */}
      {!!error && (
        <View
          style={{
            backgroundColor: theme.dangerBackground,
            borderColor: theme.dangerBorder,
            borderRadius: 14,
            borderWidth: 1,
            padding: 13,
          }}>
          <Text style={{ color: theme.danger, fontSize: 13, lineHeight: 19 }}>{error}</Text>
        </View>
      )}

      {/* Acción principal */}
      <Action
        label={
          submitting
            ? mode === 'activate'
              ? 'Activando cuenta...'
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

      {/* Navegación secundaria */}
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
            onPress={() =>
              router.push('/demo')
            }
          />
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(auth)/login')}
          style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}>
          <MaterialCommunityIcons color={theme.primary} name="arrow-left" size={18} />
          <Text style={[styles.backLinkText, { color: theme.primary }]}>Volver a iniciar sesión</Text>
        </Pressable>
      )}

      {/* Aviso demo solo para flujos demo */}
      {mode !== 'register' && (
        <Copy>
          Demostración local: usa datos
          ficticios. Las cuentas y vínculos
          se conservan al cerrar sesión y se
          reinician al recargar la app.
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
  backLinkText: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
