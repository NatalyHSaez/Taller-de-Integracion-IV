# TI4-61 — Login real

## Comportamiento implementado

- El acceso normal llama a `POST /api/v1/auth/login` y después a `GET /api/v1/me`.
- `/me` se consulta en el servicio; la pantalla no repite la petición.
- Se validan UUID, identidad y roles de la respuesta antes de abrir la aplicación.
- PATIENT entra al inicio con su UUID real; CAREGIVER entra a su pantalla de cuenta,
  con acceso al perfil. La consulta de vínculos pertenece a su integración específica.
- No se fabrican pacientes, vínculos ni mediciones para las cuentas reales. El perfil
  tampoco muestra las enfermedades y medicamentos estáticos de demostración.
- El modo de demostración requiere selección explícita. Un correo coincidente con
  una cuenta mock no desvía el login real hacia datos locales.
- Se validan correo y contraseña presente, se bloquean envíos simultáneos y se
  muestran errores comprensibles. Si falla la carga/validación de identidad, se
  revoca la sesión recibida cuando es posible y se limpian tokens y estado local.
- El contexto de autenticación recibe la identidad desde el servicio incluso si
  la navegación desmonta el formulario.

## Verificación — 3 de noviembre de 2026

- `npm run test:login`: servicio real con red y almacenamiento sustituidos por dobles;
  PATIENT/CAREGIVER, UUID, ausencia de datos clonados, una consulta a /me, rechazo
  de credenciales/roles y limpieza de sesión fallida, modo demo explícito.
- `npm run test:registration` y `npm run test:api-errors`: aprobados.
- ESLint de los archivos modificados y `npx tsc --noEmit`: aprobados.
- Expo compiló la aplicación web para la prueba local.
- Docker local: login y /me correctos para dos cuentas ficticias nuevas, una por rol;
  se revocaron las sesiones de esa comprobación HTTP.
- Interfaz web: contraseña incorrecta muestra el error; paciente válido entra al
  inicio sin mediciones de ejemplo; perfil muestra nombre/correo reales y no muestra
  enfermedades/medicamentos ficticios.
- Verificación manual de Sebastián mediante capturas: el cuidador llega a
  «Tu cuenta de cuidador» y, al abrir «Ver mi perfil», muestra el nombre
  Prueba Login CAREGIVER, el correo de prueba correspondiente y el rol Cuidador.
  Esto completa la comprobación visual del recorrido login → cuenta → perfil.
- Límites: no se probó un teléfono físico. El diálogo de cierre de sesión bloqueó
  la automatización; esta verificación no certifica el logout de TI4-62 ni la
  consulta de vínculos. El listado vacío actual no confirma ausencia de vínculos
  en el backend, porque esa consulta todavía no está integrada.

## Alcance pendiente fuera del login

TI4-62 conserva la restauración completa de sesión, refresh serializado y unificación
del logout. TI4-63 conserva la edición real del perfil y sus pruebas. Los módulos de
vínculos y salud deben conectar sus datos reales; el login no prueba su integración.

No se modificó el backend ni se aplicó la migración de roles de cuentas antiguas.
El contrato utilizado sigue siendo PATIENT/CAREGIVER. Las cuentas ficticias creadas
para estas pruebas permanecen en la base local.
