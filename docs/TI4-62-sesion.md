# TI4-62 — Sesión, renovación y salida

## Implementado

- Al abrir la aplicación, AuthProvider restaura access/refresh desde almacenamiento,
  consulta `/me`, valida identidad/rol y reconstruye el estado compartido. El navegador
  espera la restauración antes de decidir la ruta. Los cuidadores no reciben vínculos ficticios.
- El cliente comparte una sola petición `/auth/refresh` por sesión. Un 401 tardío
  reutiliza el token que otra petición ya renovó. Cada solicitud reintenta como máximo
  una vez después de renovar; un segundo 401 cierra la sesión.
- Los tokens renovados se sincronizan en memoria y almacenamiento sin borrar al usuario.
- La renovación tiene timeout. Un fallo temporal de red no elimina credenciales;
  un refresh rechazado con 401/403 sí limpia sesión, tokens y caché.
- La versión de sesión impide que una petición anterior publique datos tras salir
  o cambiar de cuenta. Un refresh que termina después de salir intenta revocar el
  nuevo token, sin guardarlo ni reabrir la sesión.
- `authService.logout()` limpia primero la sesión local y solicita la revocación
  del refresh al backend. La app sale aunque no haya red; en ese caso la revocación
  remota no puede garantizarse hasta que expire el token del servidor.
- Perfil, menú, configuración, selector y salidas de demostración utilizan el mismo
  servicio. SecureStore sigue siendo el almacenamiento nativo; web usa localStorage.
- Las escrituras y borrados se ordenan para evitar que un guardado pendiente restaure
  tokens después del logout. Una escritura incompleta limpia ambos valores.

## Evidencia — 3 de noviembre de 2026

- `npm run test:session`: restauración PATIENT/CAREGIVER; ocho solicitudes con 401 y
  un solo refresh; rotación sincronizada; refresh inválido; restauración sin red y
  posterior recuperación; logout durante refresh; logout sin red.
- La misma orden ejecuta pruebas del adaptador de almacenamiento con dobles web/native:
  guardar/borrar/guardar concurrentemente y limpieza de escritura parcial.
- `node scripts/smoke-session.cjs`: servicios reales de la app con almacenamiento
  en memoria y HTTP real a Docker. Para ambos roles: restauración, seis 401 por token
  inválido con un refresh, rotación y rechazo 401 del refresh después del logout.
  Crea dos cuentas ficticias por ejecución; conserva las cuentas y revoca las sesiones.
- Interfaz web: restauró una cuenta de cuidador al abrir la app; conservó identidad
  y nombre actualizado tras recargar Perfil; salida por «Ir al acceso» mostró Login
  y siguió sin sesión después de recargar. Las confirmaciones nativas de otros
  botones de logout no se automatizaron; comparten el mismo servicio probado.
- Regresión: pruebas de login, registro, perfil y errores API aprobadas.
- TypeScript y ESLint de los archivos modificados aprobados.

## Límites de verificación

No se probó un teléfono físico ni el almacén seguro real del dispositivo. La prueba
de concurrencia cubre una instancia de la app, no coordina varias pestañas web.
No se modificó el backend, no se actualizó Jira y no se creó commit.
