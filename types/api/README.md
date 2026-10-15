# Tipos del API móvil

Esta carpeta separa el **contrato del backend** de los modelos internos usados por la interfaz.

## Contrato ya contrastado con Integración II

Los siguientes tipos fueron actualizados contra el backend actual de `domicilia`:

- `auth.ts`: registro, login, refresh, logout y `/auth/me`.
- `notification.ts`: listado paginado de `/notificaciones`.
- `health.ts`: estado del API Gateway y microservicios.
- `common.ts`: roles devueltos por Identidad y estados actuales de Notificaciones.

Ejemplos relevantes del contrato real actual:

```ts
// POST /api/v1/auth/login
{
  correo: string;
  password: string;
}

// Respuesta login / refresh
{
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}
```

```ts
// GET /api/v1/auth/me
{
  id: string;
  nombre_completo: string;
  correo: string;
  roles: ('paciente' | 'cuidador' | 'medico' | 'administrador')[];
}
```

## Tipos que siguen provisionales

Los DTO de pacientes, lecturas, evaluaciones, alertas, atención médica y otras áreas se mantienen
por ahora porque sus endpoints todavía no están todos implementados o estabilizados. Los mocks
siguen siendo válidos para continuar desarrollando esas pantallas.

No se debe eliminar `types/measurement.ts`: sigue siendo el modelo interno de la interfaz y puede
coexistir con los DTO recibidos desde la API.
