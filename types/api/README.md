# Contrato provisional de datos del API

Estos tipos representan la forma que la aplicación móvil espera recibir desde el API Gateway mientras el backend aún no dispone de un contrato OpenAPI/Swagger definitivo.

## Regla principal

- Los nombres JSON siguen `camelCase`.
- Los identificadores se representan como `string` y corresponden a UUID.
- Las fechas y horas se representan como `string` ISO 8601 UTC.
- Los tipos de esta carpeta representan DTO del API y no reemplazan los modelos de presentación que ya usa la interfaz, por ejemplo `types/measurement.ts`.
- Cuando Integración II publique OpenAPI, estos archivos deben compararse con dicho contrato y ajustarse si cambian nombres, campos obligatorios, envoltorios de listas o paginación.

## Archivos

- `common.ts`: identificadores, fechas, roles y estados compartidos.
- `auth.ts`: sesión y usuario actual.
- `patient.ts` / `doctor.ts`: perfiles.
- `relation.ts`: vínculos, permisos y códigos QR.
- `condition.ts`: condiciones y parámetros clínicos.
- `reading.ts`: lecturas y mediciones.
- `evaluation.ts` / `alert.ts`: evaluación clínica y alertas.
- `clinical.ts`: consultas, prescripciones, documentos y addenda.
- `notification.ts`: notificaciones.
- `error.ts`: formato común de error.
