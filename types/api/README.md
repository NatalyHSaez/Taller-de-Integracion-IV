# Contratos del API (P2)

Contrastados con `domicilia/services/{identidad,relaciones,seguimiento,evaluacion,notificaciones}` y `docs/api-contract.md`.
Todas las rutas públicas van a través de `/api/v1` en el Gateway. JSON en **inglés y camelCase**.

| Archivo | Contratos activos |
| --- | --- |
| auth.ts | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/me` |
| patient.ts | `/me/patients`, `/patients/{patientId}` |
| relation.ts | QR temporal, vínculos, permisos y revocaciones |
| condition.ts | `/health-conditions`, `/clinical-parameters`, `/parameter-limits` |
| reading.ts | lecturas, confirmación, detalle, historial paginado, series de mediciones |
| evaluation.ts | evaluación **anidada en lectura** |
| alert.ts | alertas por paciente |
| notification.ts | notificaciones paginadas del usuario |
| error.ts | `detail` y `errorCode` (422 también tiene `detail` como arreglo) |
| health.ts | estado del Gateway |

**Provisionales y sin endpoint funcional:** `clinical.ts`, `doctor.ts` y `PatientConditionResponse` en `condition.ts`.
Los DTO describen respuestas del backend, no modelos visuales. `types/measurement.ts` sigue siendo modelo interno de interfaz.
Los permisos de cuidador actualmente soportados son cuatro. No confundir las advertencias de una evaluación con alertas persistidas.

**Pendientes en tareas posteriores:** P3 completa manejo uniforme de errores; P4 login/refresh sincronizado, roles y registro con birthDate; P5 obtiene UUID reales, P6 aísla mocks; S1-S5 conectan pantallas y caché.
