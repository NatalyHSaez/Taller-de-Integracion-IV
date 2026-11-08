# Capa de datos

Esta carpeta agrega caché y reintentos sobre `services/api.ts` sin reemplazar el cliente HTTP.

## Responsabilidades

- `api.ts`: HTTP, headers, Bearer token, timeout y normalización de errores.
- `data/data-client.ts`: lecturas GET con caché, deduplicación y reintentos.
- `data/cache.ts`: caché temporal en memoria.
- `data/retry.ts`: backoff para fallos transitorios.

## Política de caché

La caché es solamente en memoria. No persiste información clínica ni tokens en el dispositivo.
Por defecto una lectura permanece fresca 30 segundos y una copia expirada puede utilizarse hasta
5 minutos si la red falla de forma transitoria.

## Política de reintentos

Las lecturas GET realizan hasta 3 intentos con backoff (400 ms, 800 ms) frente a problemas de red,
timeout, HTTP 429 o errores 5xx.

No se reintentan automáticamente 401, 403, 404, 409, 422 ni otras respuestas que indican que
repetir la misma solicitud no solucionará el problema.

Las mutaciones POST/PATCH/DELETE no pasan por esta política automática para evitar duplicar
operaciones con efectos secundarios.
