# Tarea 9 - Manejo centralizado de errores de API

Esta carpeta concentra la interpretación de errores provenientes de la API.

El formato esperado es:

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

`ApiError` transforma ese JSON en un error uniforme para el frontend y conserva
`code`, `message`, `details`, `correlationId` y, cuando existe, el status HTTP.

Funciones principales:

- `apiErrorFromResponse(response)`: interpreta una respuesta HTTP fallida.
- `apiErrorFromPayload(payload)`: interpreta un JSON que ya tiene el formato común.
- `normalizeApiError(cause)`: transforma cualquier error desconocido en `ApiError`.
- `getApiErrorMessage(cause)`: obtiene el mensaje para mostrar en la interfaz.

Mientras no exista backend, los mocks también lanzan `ApiError`, de manera que
las pantallas trabajen desde ahora con el mismo mecanismo que utilizarán cuando
se conecte el API Gateway real.
