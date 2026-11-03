# TI4-63 — Edición del perfil propio

## Implementado

- Perfil → Editar información → Guardar cambios llama a `PATCH /api/v1/me`
  mediante el cliente HTTP compartido y su Bearer token.
- El contrato local de identidad (`schemas.py`, `UpdateMeRequest`) solo permite
  `fullName`, de 3 a 200 caracteres. Se recortan espacios exteriores y se valida
  antes de enviar. No se envían correo, fecha, rol ni ID.
- El correo permanece visible sin edición. La fecha no se ofrece como campo
  editable en cuentas reales porque este endpoint no la admite.
- Mientras guarda, bloquea envíos duplicados y la cancelación del formulario.
- La respuesta confirmada actualiza el contexto de autenticación y la identidad
  del store compartido sin recrear vínculos, selección ni mediciones.
- Ante error conserva el formulario y los datos anteriores. Ante timeout/red o
  respuesta incierta recomienda comprobar el perfil antes de repetir.
- Una respuesta de otra identidad o de una sesión anterior no modifica el estado.
- El listado de vínculos sin integrar ya no afirma que el cuidador no tenga pacientes.

## Verificación del 3 de noviembre de 2026

- `npm run test:profile`: aprobado, con red y almacenamiento simulados; valida
  límites del nombre, payload exclusivo, Bearer, ambos roles, sincronización y
  errores 422/500/respuesta de identidad incorrecta sin publicar cambios locales.
- `npm run test:login`: aprobado como regresión.
- `npx tsc --noEmit` y ESLint de archivos modificados: aprobados.
- Prueba real completada después de iniciar Docker: PATIENT y CAREGIVER,
  PATCH 200, nombre corto 422 sin modificación y GET con nombre conservado tras
  cerrar sesión y volver a ingresar (`node scripts/smoke-profile.cjs`).
- Interfaz web verificada con la cuenta ficticia de cuidador: rechazo de nombre
  corto, correo sin edición, cambio a «Cuidador Prueba TI4-63» y persistencia del
  nombre al recargar la página; también se restauró su sesión.

## Cómo repetir la verificación

1. Iniciar Docker Desktop y el backend local con `docker compose up -d`.
2. Desde el repositorio móvil ejecutar `node scripts/smoke-profile.cjs`.
   Crea dos cuentas ficticias nuevas, PATIENT y CAREGIVER; prueba PATCH 200,
   rechazo 422 sin cambiar el nombre y persistencia mediante GET después de
   cerrar sesión y volver a ingresar. Revoca las sesiones; conserva las cuentas.
3. En la app, iniciar sesión con una cuenta de prueba, abrir Perfil, editar el
   nombre y guardar. Comprobar confirmación y nombre actualizado también en Inicio.
4. Probar nombre corto, cancelación y error de conexión. Confirmar que correo y
   fecha no se envíen como modificaciones. Verificar también en teléfono físico.

Estado: implementación y pruebas automáticas, Docker e interfaz web completadas.
Queda la comprobación en teléfono físico. TI4-62 se implementó en este mismo lote;
su evidencia está en TI4-62-sesion.md. No se cambió el backend.
