# Contratos del API Gateway

Los endpoints mantienen el prefijo `/api/v1` y el contrato actual en inglés y camelCase. La organización distingue los tipos operativos de la app, los DTO de transporte que necesitan los adaptadores y los contratos históricos de pruebas.

| Responsabilidad | Ubicación actual |
| --- | --- |
| Identificadores, rol, sesión y salud del Gateway | `src/core/domain/contracts/` |
| Errores normalizados y contrato de errores | `src/core/domain/errors/` |
| Solicitudes de cuenta y ficha de paciente | `src/modules/identity/domain/` |
| Registro de mediciones, catálogo y tipos de consulta | `src/modules/monitoring/domain/` |
| DTO de respuesta de lecturas y series | `src/modules/monitoring/infrastructure/dto/reading.ts` |
| Relaciones, alertas y notificaciones | `domain/` de cada módulo; los adaptadores están en `infrastructure/api/` |
| Contratos históricos o provisionales utilizados por fixtures | `tests/fixtures/contracts/` |

Los modelos históricos de lectura con `valueNumeric` y `recordedByUserId` solo permanecen en las fixtures. El detalle productivo utiliza `getPatientReading` y el contrato actual con `value`, `status`, `recordedBy` y `evaluation`. El registro conserva `CreateReadingRequest` y `CreateReadingResponse`. Los adaptadores de alertas y notificaciones reciben respuestas desconocidas y las validan antes de convertirlas a sus modelos: no requieren duplicar tipos que no utilizan.

Los límites técnicos no sustituyen las reglas clínicas. El backend es responsable de las evaluaciones. Los contratos provisionales de atención médica o asignación de condiciones no prueban que sus endpoints estén disponibles; se deberán contrastar con Integración II antes de integrarlos.
