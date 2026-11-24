# Contratos del API móvil

Esta carpeta define los DTO del **API Gateway** y reexporta los tipos compartidos
de `src/core/domain/contracts`. Las capas internas importan los contratos desde
dominio y no desde esta carpeta. Las rutas públicas se consumen con el prefijo
`/api/v1` y, en los contratos contrastados, las propiedades JSON se expresan en
inglés y **camelCase**.

## Contratos y módulos

| Archivo | Uso principal |
| --- | --- |
| `auth.ts` | Registro, login, refresh, logout y `GET /me` |
| `patient.ts` | Perfil y pacientes accesibles para el usuario |
| `relation.ts` | Códigos temporales, relaciones, permisos y revocación |
| `condition.ts` | Catálogo de condiciones, parámetros y límites técnicos; algunas estructuras siguen provisionales |
| `reading.ts` | Solicitudes de lecturas, tipos legados de demo y tipos de historial, detalle y series reales |
| `evaluation.ts` | DTO anterior de evaluación (no confundir con la evaluación anidada en una lectura real) |
| `alert.ts` | Alertas del paciente |
| `notification.ts` | Notificaciones y estados de entrega/lectura |
| `error.ts` | Errores de FastAPI (`detail`, `errorCode`) y formato interno normalizado |
| `health.ts` | Estado del Gateway |
| `common.ts` | Identificadores, roles y estados compartidos |
| `clinical.ts`, `doctor.ts` | Modelos todavía provisionales donde el flujo no está completamente integrado |

## Autenticación: ejemplo del contrato actual

```ts
// POST /api/v1/auth/login
{ email: string; password: string; }

// Respuesta de login / refresh
{ accessToken: string; refreshToken: string; tokenType: string; expiresIn: number; }

// GET /api/v1/me
{ id: string; fullName: string; email: string;
  roles: ('PATIENT' | 'CAREGIVER' | 'DOCTOR' | 'ADMIN')[]; }
```

## Lecturas: dos formatos durante la transición

`reading.ts` conserva **dos familias separadas de tipos**. No deben intercambiarse:

- `ReadingResponse` y `MeasurementResponse` representan el formato **legado**
  que todavía producen `tests/fixtures/demo/mocks/api-data.ts`, el adaptador
  `measurement-mapper.ts` y ciertos flujos locales. Usan `recordedByUserId`,
  `valueNumeric`, `valueText` y `validationStatus`.
- `BackendReadingResponse`, `BackendMeasurementResponse`, `ReadingPageResponse` y
  `MeasurementPointResponse` describen respuestas **reales** del seguimiento.
  Usan `recordedBy`, `status`, `confirmationReasons`, `value` y una evaluación
  anidada cuando el backend la informa. Su representación operativa también
  está en `src/modules/monitoring/infrastructure/readings-api.ts`.
- `CreateReadingRequest` y `CreateReadingResponse` son los contratos del flujo
  de registro y confirmación de mediciones de la aplicación. Una lectura de
  glucosa lleva contexto `PREPRANDIAL` o `POSTPRANDIAL`; SBP y DBP viajan juntas.

La separación es temporal: una futura migración debe actualizar los adaptadores
legados y eliminar la duplicación de DTO, **no** forzar datos reales a usar
`valueNumeric` ni inventar mediciones para usuarios del backend.

## Precauciones

Los permisos del cuidador se obtienen de los vínculos reales, no de los mocks.
Las advertencias de una evaluación no son automáticamente alertas persistidas.
Los límites técnicos de parámetros no sustituyen reglas clínicas de evaluación.
`src/modules/monitoring/domain/measurement.ts` sigue siendo el modelo interno de
la interfaz y puede coexistir con estos DTO.

El contrato de error y su interpretación se documentan en `../errors/README.md`.
Las partes que todavía sean provisionales se deben validar nuevamente contra
Integración II antes de considerarlas listas para producción.
