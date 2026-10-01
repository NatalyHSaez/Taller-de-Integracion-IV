import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native';

import { useDemo } from '@/hooks/use-demo';
import { register } from '@/services/api';
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
       * REGISTRO REAL
       * ============================
       */
      if (mode === 'register') {
        const {
          cleanName,
          cleanEmail,
        } = validateRegister();

        setSubmitting(true);

        await register({
          nombre_completo: cleanName,
          correo: cleanEmail,
          password,
          rol: role,
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
          value={name}
          onChangeText={setName}
          autoComplete="name"
          autoCapitalize="words"
        />
      )}

      {/* Código de activación */}
      {mode === 'activate' && (
        <Field
          label="Código de invitación del centro"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
        />
      )}

      {/* Correo */}
      <Field
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />

      {/* Contraseña */}
      <Field
        label="Contraseña"
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
      />

      {/* Confirmar contraseña */}
      {mode !== 'login' && (
        <>
          <Copy>
            Usa al menos 8 caracteres.
          </Copy>

          <Field
            label="Repite la contraseña"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      )}

      {/* Mostrar / ocultar contraseña */}
      <Action
        secondary
        label={
          visible
            ? 'Ocultar contraseña'
            : 'Mostrar contraseña'
        }
        onPress={() =>
          setVisible((current) => !current)
        }
      />

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
                      ? '#2563EB'
                      : '#D1D5DB',
                  backgroundColor:
                    role === 'paciente'
                      ? '#EFF6FF'
                      : 'transparent',
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
                        ? '#2563EB'
                        : '#6B7280',
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
                      ? '#2563EB'
                      : '#D1D5DB',
                  backgroundColor:
                    role === 'cuidador'
                      ? '#EFF6FF'
                      : 'transparent',
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
                        ? '#2563EB'
                        : '#6B7280',
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
                    ? '#2563EB'
                    : '#9CA3AF',
                backgroundColor:
                  privacyAccepted
                    ? '#2563EB'
                    : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {privacyAccepted && (
                <Text
                  style={{
                    color: '#FFFFFF',
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
        <Card>
          <Copy>
            {error}
          </Copy>
        </Card>
      )}

      {/* Acción principal */}
      <Action
        label={
          submitting
            ? 'Creando cuenta...'
            : mode === 'login'
              ? 'Iniciar sesión'
              : mode === 'activate'
                ? 'Activar cuenta'
                : 'Crear cuenta'
        }
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
        <Action
          secondary
          label="Volver a iniciar sesión"
          onPress={() =>
            router.replace('/(auth)/login')
          }
        />
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