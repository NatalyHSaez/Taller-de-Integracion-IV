# Preparación de notificaciones push — Grupo 9

## Instalación y configuración

Desde la raíz móvil, antes de incorporar el plugin en `app.json`, ejecutar `npx expo install expo-notifications expo-dev-client`. Expo elige versiones compatibles con el SDK 57 declarado; conservar los cambios de `package.json` y `package-lock.json`. `expo-constants` ya está instalado. No actualizar el SDK ni sustituir manualmente el lockfile.

El plugin `expo-notifications` configura el canal predeterminado `health-updates`. El adaptador crea el canal Android «Avisos de salud» cuando el usuario solicita permisos; importancia DEFAULT y visibilidad PRIVATE en bloqueo. No se habilita procesamiento remoto en segundo plano en iOS. No se piden alarmas exactas ni permisos adicionales ajenos a push. Los ajustes del usuario prevalecen. El contenido futuro deberá ser genérico, sin diagnóstico ni valores clínicos en el aviso.

## Probar permisos

- La pantalla Notificaciones tiene un panel para consultar el permiso y, si el sistema permite solicitarlo, hacerlo mediante un toque explícito. No se solicita al arrancar ni al iniciar sesión. El permiso es del dispositivo, no indica que la cuenta esté inscrita para push.
- Web y Expo Go se informan como no compatibles con este flujo de push; no se carga el módulo de notificaciones en esos entornos. Android e iOS requieren una compilación propia. La lectura de permiso no crea canales ni pide permisos; la solicitud crea el canal Android antes de solicitar al sistema. Si el sistema bloquea la solicitud, modificar en ajustes y volver a consultar.
- iOS distingue autorización plena, provisional, temporal, denegada y no determinada. No se interpreta la autorización provisional como plena.
- En Android, para una compilación local con JDK y Android Studio configurados, conectar un dispositivo y ejecutar `npx expo run:android`. Acordar previamente el identificador de aplicación con el equipo si Expo lo solicita. Para futuras sesiones del mismo cliente, `npx expo start --dev-client`. En iOS la compilación local requiere macOS/Xcode; desde Windows puede usarse EAS con las credenciales correspondientes. Expo Go y web siguen siendo opciones para validar funciones internas, no entrega push.
- Verificar `npx expo config --type prebuild` y `npx expo install --check` después de instalar. La configuración JS no modifica un binario ya instalado: compilar nuevamente cuando cambian los plugins nativos.

## Pendiente deliberado

No se inventa `projectId`, `android.package`, `ios.bundleIdentifier`, credenciales FCM/APNs ni una configuración EAS vinculada a una cuenta inexistente. Definirlos con el equipo antes de las pruebas de entrega. Grupos posteriores: obtención del token Expo, ciclo de vida y asociación con sesión, recepción/navegación, endpoints acordados con Integra II, desvinculación y entrega real. No registrar secretos ni tokens en Git o TXT. Los permisos no son un sistema de emergencias ni garantizan entrega.

Referencias oficiales: [Expo Notifications SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/), [configuración push](https://docs.expo.dev/push-notifications/push-notifications-setup/), [compilaciones locales](https://docs.expo.dev/guides/local-app-development/).
