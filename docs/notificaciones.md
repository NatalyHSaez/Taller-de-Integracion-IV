# Notificaciones de la app

## Son notificaciones internas, no push

Las notificaciones que muestra la app (`app/notificaciones.tsx` y
`app/notificacion/[id].tsx`) son **internas**: el servicio `notificaciones` del
backend las guarda y la app las **consulta** cuando la persona abre la pantalla,
desliza para actualizar o vuelve a ella.

**Todavía no existe envío push.** Desde el Grupo 9 la app prepara Expo Notifications y permite consultar o solicitar el permiso del dispositivo desde Notificaciones. No obtiene ni registra tokens, no recibe avisos remotos y no activa FCM ni APNs. Las notificaciones internas siguen funcionando de forma independiente.

Ver [preparación de push](push-notificaciones.md) para instalación, compilación y límites.

## Endpoints

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/v1/notifications?page=&size=&status=` | Lista paginada del usuario autenticado. `status`: `pending`, `sent` o `read`. Respuesta `{ total, page, size, items }`, de la más reciente a la más antigua. |
| POST | `/api/v1/notifications/{notificationId}/read` | Marca como leída. Responde **204** sin cuerpo, también si ya estaba leída. 404 `NOTIFICATION_NOT_FOUND` si no existe o no es del usuario. |

No hay `GET` de una notificación individual: el detalle usa los datos ya
recibidos en la lista (caché en memoria de `src/modules/notifications/application/use-cases/notifications.ts`). Si la
app se abre directamente en el detalle, primero se carga la primera página.

## Comportamiento en la app

- **Del usuario, no del paciente:** al cambiar de usuario (cerrar sesión, entrar
  con otra cuenta) se descartan la lista y la caché. Cambiar de paciente no las
  afecta.
- **Sin datos simulados en producción:** si el servidor falla se muestra el
  error (sesión expirada, sin permiso, no encontrada o error de red, este último
  con «Reintentar»). Los ejemplos existen únicamente en las fixtures de pruebas.
- **Paginación sin duplicados:** se descartan ids repetidos; si se marca como
  leída una notificación mientras está activo el filtro interno de estado
  `pending` o `sent`, la siguiente página se pide desde una posición anterior para no
  saltarse ninguna.
- **Filtros visibles:** «No leídas» reúne los estados `pending` y `sent`; «Leídas» utiliza `read`.
- **Leída:** se marca mediante la acción «Marcar como leída»; abrir el detalle por sí solo no modifica el estado. Tras el 204
  se actualizan la lista y el detalle sin recargar; al volver a consultar, el
  backend la devuelve como leída.
