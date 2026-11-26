# Manejo centralizado de errores del API (P3)

Esta carpeta adapta respuestas HTTP del API Gateway. La clase `ApiError` y
la normalización de valores simples están en `src/core/domain/errors` y se
reexportan aquí para mantener compatibilidad. Las pantallas manejan esa misma clase y **nunca deben tratar un error
de red como si se hubiese recibido una respuesta simulada correcta**.

## Formatos admitidos

### 1. Respuesta actual de FastAPI

```json
{ "detail": "Credenciales inválidas" }
```

Con un código estable de negocio:

```json
{
  "detail": "El código expiró. Pide al paciente que genere uno nuevo.",
  "errorCode": "CODE_EXPIRED"
}
```

En HTTP 422, FastAPI puede devolver `detail` como arreglo de validaciones,
con objetos que contienen `loc`, `msg`, `type` y otros campos.

### 2. Formato interno de la aplicación (y mocks antiguos)

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "No posee permiso para realizar esta operación.",
    "details": {},
    "correlationId": "uuid"
  }
}
```

Este formato es producido por `ApiError.toResponse()` y **no es** el cuerpo
HTTP que se espera del backend actual.

## Normalización con `ApiError`

Toda respuesta se transforma a una instancia con `code`, `message`, `details`,
`correlationId` y `status` (si hay un estado HTTP conocido).

- `errorCode` tiene prioridad como código; también se reconoce el alias antiguo
  `codigo_error` para compatibilidad.
- Sin código estable se deriva uno del estado HTTP, como `AUTHENTICATION_REQUIRED`
  (401), `PERMISSION_DENIED` (403), `VALIDATION_ERROR` (422) o
  `SERVICE_UNAVAILABLE` (503).
- El `detail` textual puede mostrarse como mensaje. Un arreglo de validaciones
  recibe un mensaje general en español.
- `details.validation` conserva **solo** `loc`, `msg` y `type`: **no** copia
  `input`, `ctx` ni otras propiedades que puedan contener datos sensibles.
- El encabezado `X-Correlation-ID` de la respuesta tiene prioridad; si falta,
  se conserva el identificador enviado en la solicitud. En errores locales se
  genera un identificador.
- Los errores HTTP con cuerpos HTML, JSON malformado o texto técnico no
  contractual reciben un mensaje genérico. El parser admite texto breve y
  seguro del Gateway como alternativa de compatibilidad.
- No se registran contraseñas, cuerpos HTTP ni `error.details` completos en
  consola. Las decisiones funcionales deben comparar `error.code`, no textos.

## Funciones disponibles

- `apiErrorFromResponse(response, requestCorrelationId?)`: lee un error HTTP.
- `apiErrorFromPayload(payload)`: normaliza el DTO del backend o el interno.
- `isApiErrorResponse(value)`: comprueba el formato de FastAPI.
- `isClientApiErrorResponse(value)`: comprueba el formato interno de los mocks.
- `normalizeApiError(cause)`: convierte errores desconocidos a `ApiError`.
- `getApiErrorMessage(cause)`: obtiene un mensaje para la pantalla.

```ts
import { normalizeApiError } from '@/src/core/domain/errors';

try {
  await operacion();
} catch (cause) {
  const error = normalizeApiError(cause);
  // La lógica utiliza error.code; la pantalla puede mostrar error.message.
}
```

La política de caché y reintentos se documenta en `../data/README.md`.
Para verificar el parser en `main`, ejecutar `npm run test:api-errors`.
Las pruebas de contratos y regresión se ejecutan con `npm test`.
