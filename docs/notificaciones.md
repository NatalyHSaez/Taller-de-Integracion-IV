# Notificaciones de la app

## Son notificaciones internas, no push

Las notificaciones que muestra la app (`app/notificaciones.tsx` y
`app/notificacion/[id].tsx`) son **internas**: el servicio `notificaciones` del
backend las guarda y la app las **consulta** cuando la persona abre la pantalla,
desliza para actualizar o vuelve a ella.

**No existe envío push.** La app no usa Expo Notifications, Firebase Cloud
Messaging (FCM) ni Apple Push Notification service (APNs), no registra tokens de
dispositivo y no recibe avisos con la app cerrada. Si en el futuro se necesitan,
habría que agregar el registro de tokens en el backend y el envío desde el
servicio `notificaciones`.

## Endpoints

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/v1/notifications?page=&size=&status=` | Lista paginada del usuario autenticado. `status`: `pending`, `sent` o `read`. Respuesta `{ total, page, size, items }`, de la más reciente a la más antigua. |
| POST | `/api/v1/notifications/{notificationId}/read` | Marca como leída. Responde **204** sin cuerpo, también si ya estaba leída. 404 `NOTIFICATION_NOT_FOUND` si no existe o no es del usuario. |

No hay `GET` de una notificación individual: el detalle usa los datos ya
recibidos en la lista (caché en memoria de `services/notifications.ts`). Si la
app se abre directamente en el detalle, primero se carga la primera página.

## Comportamiento en la app

- **Del usuario, no del paciente:** al cambiar de usuario (cerrar sesión, entrar
  con otra cuenta) se descartan la lista y la caché. Cambiar de paciente no las
  afecta.
- **Sin datos simulados en sesión real:** si el servidor falla se muestra el
  error (sesión expirada, sin permiso, no encontrada o error de red, este último
  con «Reintentar»). Los ejemplos solo se usan en el modo demostración.
- **Paginación sin duplicados:** se descartan ids repetidos; si se marca como
  leída una notificación mientras está activo el filtro «Pendientes» o
  «Enviadas», la siguiente página se pide desde una posición anterior para no
  saltarse ninguna.
- **Leída:** se marca al abrir el detalle o con «Marcar como leída». Tras el 204
  se actualizan la lista y el detalle sin recargar; al volver a consultar, el
  backend la devuelve como leída.
