# Capa de datos — P3

`services/api.ts` concentra HTTP, Bearer token, timeout, cancelación y normalización.
`data-client.ts` añade caché en memoria, deduplicación de GET y reintentos.
`cache.ts` conserva respuestas temporalmente; `retry.ts` define la política común.

## Reintentos

Por defecto, GET permite hasta tres intentos con esperas de 400 y 800 ms.
Se admiten HTTP 408, 429, 500, 502, 503 y 504. Si existe un estado HTTP, este decide
por sobre el texto de `error.code`: un 403 nunca se reintenta aunque su código diga
`SERVER_ERROR`. Otros 4xx, 501 y 505 tampoco se reintentan.

Sin estado HTTP, se admiten `NETWORK_ERROR`, `REQUEST_TIMEOUT`,
`SERVICE_UNAVAILABLE`, `SERVER_ERROR`, `TOO_MANY_REQUESTS` y
`AUTHORIZATION_UNAVAILABLE`. Una cancelación no se reintenta.

Esta es la política de `dataClient`. La renovación de tokens ante un 401 que ya
existe en `api.ts` es otro mecanismo, cuya consolidación corresponde a P4.
POST/PATCH/DELETE no utilizan los reintentos automáticos de esta capa.

## Caché

La caché permanece solo en memoria. Por defecto, una entrada dura 30 segundos y
puede usarse durante cinco minutos adicionales ante un fallo transitorio.
La misma función `isRetryableApiError` decide qué fallos permiten esta copia.

Un fallo no transitorio descarta la entrada afectada y se propaga como `ApiError`.
Así, un 401/403/404/422 recibido desde la red no devuelve información cacheada ni
queda oculto por ella en la siguiente lectura. Una entrada aún fresca evita la
petición de red: usar `forceRefresh` cuando corresponda comprobar el estado actual.

`clearCache()` cambia la generación: una petición antigua no puede escribir en la
caché nueva, recuperar su contenido como respaldo de un fallo ni borrar sus
peticiones en curso. La selección de paciente y el aislamiento completo de sesión
continúan desarrollándose en P4–P6.

Notificaciones usa `staleIfErrorMs: 0`, fuerza red al enfocar/refrescar y propaga
fallos. Los datos de demostración requieren una sesión explícita `mock`.
El detalle de lectura conserva su configuración previa de caché temporal.
