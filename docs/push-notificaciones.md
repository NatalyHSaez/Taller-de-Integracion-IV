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

## Grupo 10: obtención del token Expo

Desde Notificaciones, consultar el permiso y pulsar «Comprobar token push» si está concedido (incluidos los estados provisional y temporal de iOS). No se solicita el permiso implícitamente ni se obtiene el token al arrancar. Se comprueba la sesión autenticada antes y después de la solicitud, y se vuelve a consultar el permiso antes de devolver un token válido. Las peticiones concurrentes de la misma sesión comparten la operación; una nueva comprobación vuelve a consultar Expo. En Android se prepara el canal antes de obtener el token.

El identificador del proyecto se obtiene de `Constants.expoConfig.extra.eas.projectId` o `Constants.easConfig.projectId`; si falta, no tiene formato UUID o ambos valores discrepan, no se llama al proveedor. Se requiere vincular el proyecto real del equipo con Expo/EAS, configurar identificadores de aplicación y credenciales de push según plataforma y compilar el cliente nativo. No se proporciona ningún UUID de ejemplo en la configuración. La obtención utiliza el servicio Expo, requiere conexión y puede fallar; el usuario puede reintentar. El token se mantiene únicamente durante la operación, no se imprime, muestra, copia ni guarda en almacenamiento local. La pantalla recibe solo el estado de la última comprobación, que no garantiza entrega ni vigencia posterior. La integración posterior debe gestionar rotación mediante el listener nativo y registrar/desvincular la instalación con el backend; no existe esa integración en este grupo. No enviar datos clínicos ni tokens a registros de diagnóstico.

## Seguridad residual (25-11-2026)

La última auditoría local del Grupo 9 reportó seis hallazgos (tres altos, tres moderados, ninguno crítico) tanto completos como sin dependencias de desarrollo. `brace-expansion` 1.1.22 y `shell-quote` 1.12.0 ya no aparecían en el informe. Quedan las cadenas `expo-router@57.0.32 → query-string@7.1.3 → decode-uri-component@0.2.2` (GHSA-vcc3-ghjq-m6fr, GHSA-qr28-fpjm-wq7f) y `expo@57.0.34 → @expo/fingerprint@0.20.17 → minimatch@10.2.6` (GHSA-g3hv-75wg-m249). No ejecutar `npm audit fix --force`: la propuesta de npm cambiaría versiones principales de Expo. Revisar actualizaciones compatibles o una mitigación evaluada, volver a auditar y resolver o aceptar formalmente el riesgo antes de producción con información real. Durante el desarrollo usar únicamente datos ficticios. El resultado de auditoría no demuestra por sí solo que una vulnerabilidad sea explotable en el binario móvil.
