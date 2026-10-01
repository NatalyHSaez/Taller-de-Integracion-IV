# Tarea 9 - Manejo centralizado de errores de API

Esta carpeta concentra la interpretación de errores provenientes de los mocks,
del API Gateway y de los microservicios.

## Formatos que acepta actualmente

La aplicación mantiene internamente `ApiError`, pero el parser admite más de un
formato de respuesta mientras Integración II termina de unificar su contrato.

### 1. Formato común definido originalmente en la propuesta

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

### 2. Formato actual de FastAPI

```json
{
  "detail": "Credenciales inválidas"
}
```

### 3. Formato con código estable previsto por Integración II

```json
{
  "detail": "El código expiró. Pide al paciente que genere uno nuevo.",
  "codigo_error": "CODIGO_EXPIRADO"
}
```

También se soporta el `detail` en forma de lista que FastAPI genera para errores
de validación HTTP 422. Los detalles técnicos se conservan en
`error.details.validation`, mientras que la interfaz recibe un mensaje general y
estable.

## ApiError

Toda respuesta anterior se transforma a una instancia de `ApiError` con:

- `code`
- `message`
- `details`
- `correlationId`
- `status`

Cuando el backend entrega `codigo_error`, este se usa como `code`. Si todavía no
lo entrega, se obtiene un código general a partir del HTTP status, por ejemplo:

- 400 -> `INVALID_REQUEST`
- 401 -> `AUTHENTICATION_REQUIRED`
- 403 -> `PERMISSION_DENIED`
- 404 -> `RESOURCE_NOT_FOUND`
- 409 -> `CONFLICT`
- 410 -> `RESOURCE_GONE`
- 422 -> `VALIDATION_ERROR`
- 429 -> `TOO_MANY_REQUESTS`
- 503 -> `SERVICE_UNAVAILABLE`

El texto enviado por `detail` sí se conserva como mensaje cuando es una cadena.
Así, por ejemplo, un login incorrecto puede mostrar `Credenciales inválidas` sin
que la pantalla tenga que conocer el formato de FastAPI.

## Funciones principales

- `apiErrorFromResponse(response)`: interpreta una respuesta HTTP fallida.
- `apiErrorFromPayload(payload)`: interpreta el formato común original.
- `normalizeApiError(cause)`: transforma cualquier error desconocido en `ApiError`.
- `getApiErrorMessage(cause)`: obtiene el mensaje que puede mostrar la interfaz.

Los mocks continúan lanzando `ApiError`, por lo que las pantallas mantienen el
mismo manejo tanto con datos simulados como con solicitudes reales.
