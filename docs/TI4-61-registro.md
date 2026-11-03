# TI4-61 — Integración de registro

Endpoint conectado: `POST /api/v1/auth/register`, público, sin Bearer.

- Paciente: `fullName`, `email`, `password`, `role: PATIENT`, `birthDate`.
- Cuidador: los mismos campos comunes y `role: CAREGIVER`, sin fecha.
- La fecha se ingresa como DD/MM/AAAA y se convierte a YYYY-MM-DD sin cambio de zona horaria.
- Ambos registros usan el backend. No crean cuentas en demo-store ni inician sesión automáticamente.
- Se bloquean envíos simultáneos, fechas imposibles/futuras, contraseña fuera de 8–128 caracteres,
  nombre fuera de 3–200, confirmación distinta y falta de aceptación de privacidad.
- El servidor valida finalmente el correo y el contrato. Los errores se muestran en pantalla.
- Tras confirmar la respuesta aparece Cuenta creada, con botón para ir al login en móvil y web.
- Ante timeout/red se avisa que el resultado es incierto y se sugiere intentar iniciar sesión;
  no se reenvía el POST automáticamente.

## Verificación del 30 de octubre de 2026

- `npm run test:registration`: validaciones, payload de ambos roles, cabeceras públicas,
  errores HTTP y respuesta incompleta. Red y almacenamiento sustituidos por dobles de prueba.
- ESLint de los archivos modificados: aprobado.
- Exportación web de Expo: aprobada.
- Prueba real contra Docker con dos cuentas ficticias nuevas: ambos registros 201,
  duplicados 400, login 200, GET /me 200, logout 204; paciente sin fecha 422.
- `node scripts/smoke-registration.cjs` permite repetir la prueba real: crea DOS cuentas
  ficticias nuevas por ejecución, deja esas cuentas en la base local y revoca sus sesiones.
- No se probó la interacción en teléfono físico. TypeScript global conserva el error anterior
  de ruta en `app/historial.tsx:189`.

La discrepancia de roles de usuarios antiguos sigue pendiente del equipo backend. Este cambio
usa el contrato actual PATIENT/CAREGIVER; no modifica las tablas ni el código backend.
El éxito de estas pruebas no cierra toda TI4-61: queda la validación completa del flujo de login
desde la interfaz, y las tareas de sesión y perfil TI4-62/TI4-63 continúan separadas.
