# P3 — Manejo centralizado de errores

El contrato comprobado en `domicilia/services/comun/errores.py` es:

```json
{ "detail": "El código expiró. Pide al paciente que genere uno nuevo.", "errorCode": "CODE_EXPIRED" }
```

FastAPI también devuelve errores sin `errorCode`, incluido HTTP 422 con un arreglo
`detail` de elementos `{ loc, msg, type, ... }`. El Gateway puede devolver 401 o 503
con solo un `detail` textual. No se comparan mensajes para decidir comportamientos.

## Representación interna

`ApiError` mantiene `code`, `message`, `details`, `correlationId` y `status`.

- `errorCode` se conserva como `code`, incluso si es un código nuevo.
- `detail` textual se conserva como mensaje. Los arreglos 422 producen un mensaje
  general en español; `details.validation` conserva `loc`, `msg` y `type`.
- No se copian `input`, `ctx` ni campos adicionales de validación. No registrar el
  cuerpo de errores ni `details` en consola; los mensajes de validación pueden
  contener datos enviados por el usuario.
- Sin código estable, se utiliza un código según el estado HTTP.
- El estado HTTP se mantiene; normalizar un objeto sin respuesta HTTP no lo inventa.
- La cabecera `X-Correlation-ID` recibida tiene prioridad. Si falta, se usa el ID
  enviado en la petición. Para errores exclusivamente locales se genera un ID.
- HTML, texto no contractual, JSON roto y cuerpos vacíos reciben un mensaje genérico;
  el contenido técnico no se muestra en la UI.

## Compatibilidad

`ApiErrorResponse` describe el contrato HTTP real. `LocalApiErrorResponse` describe
`ApiError.toResponse()` y los mocks anteriores. Se acepta `codigo_error` únicamente
como compatibilidad, con prioridad inferior a `errorCode`.

- `isApiErrorResponse`: comprueba el DTO HTTP actual.
- `isLocalApiErrorResponse`: comprueba la serialización interna anterior.
- `apiErrorFromPayload`: acepta ambos DTO.
- `apiErrorFromResponse(response, requestCorrelationId?)`: interpreta errores HTTP.
- `normalizeApiError`: mantiene una instancia existente o normaliza un error desconocido.
- `getApiErrorMessage`: obtiene el mensaje para la pantalla.

```ts
try {
  await operacion();
} catch (cause) {
  const error = normalizeApiError(cause);
  // Las decisiones usan error.code; la UI muestra error.message.
}
```

Los mocks siguen lanzando `ApiError`. P3 no convierte un fallo de backend en un éxito
simulado. La política de reintentos y caché se documenta en `../data/README.md`.

Pruebas: `node scripts/test-p3.cjs` desde la raíz del proyecto.
