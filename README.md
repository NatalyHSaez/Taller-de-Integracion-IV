# Sistema de Acompañamiento de Salud — App móvil

**Curso:** INFO1173 - Taller de Integración IV

Aplicación móvil para pacientes y cuidadores, desarrollada con Expo, React Native y TypeScript. Consume el API Gateway del backend de Integración II.

## Funcionalidades actuales

- Registro, autenticación, renovación de sesión y perfil.
- Vínculos de pacientes y cuidadores, códigos QR y permisos.
- Registro y confirmación de mediciones de presión arterial, glucosa y peso.
- Historial, gráficos, detalle de lecturas y resultados clínicos entregados por el backend.
- Alertas y notificaciones internas con marcado de lectura.
- Catálogo general de condiciones clínicas.

Pendiente: condiciones asignadas al paciente, completar validación clínica real, integración de atención médica/documentos y notificaciones push. La app no genera diagnósticos ni datos clínicos de demostración.

## Arquitectura

La app usa arquitectura limpia modular por funcionalidades, no un módulo por microservicio. El backend de Integración II consolida acceso, clínico, notificaciones y auditoría; la app se conecta solo al Gateway en `/api/v1`.

```text
app/                         Rutas Expo Router
composition/                 Inyección de dependencias
src/core/                    Sesión, contratos comunes, transporte y errores
src/modules/identity/        Identidad y perfiles (acceso)
src/modules/relationships/   Vínculos y permisos (acceso)
src/modules/monitoring/      Mediciones y catálogos (clínico)
src/modules/evaluation/      Alertas (clínico)
src/modules/notifications/   Notificaciones internas
src/modules/dashboard/       Resumen de inicio
src/modules/medical-care/    Presentación pendiente de integración
src/shared/presentation/     Componentes y tema comunes
tests/                       Pruebas y fixtures aisladas
scripts/                     Verificaciones y pruebas específicas
docs/                        Documentación
```

Ver [arquitectura](docs/arquitectura.md), [contratos](docs/contratos-api.md) y [notificaciones](docs/notificaciones.md).

## Entorno local

Instalar dependencias con `npm ci`. La versión de Expo declarada en package.json es SDK 57; utilizar un cliente compatible con esa versión. No cambiar el SDK para esta actualización.

Crear `.env.local` a partir de `.env.example` y establecer `EXPO_PUBLIC_API_URL` sin el sufijo `/api/v1`:

| Entorno | URL de ejemplo |
|---|---|
| Web en el mismo computador | `http://localhost:8000` |
| Emulador Android estándar | `http://10.0.2.2:8000` |
| Teléfono físico | `http://192.168.X.X:8000` |

El teléfono debe poder alcanzar el Gateway en la red local. La variable es obligatoria para consumir la API; no se selecciona automáticamente una URL. No incluir secretos en variables `EXPO_PUBLIC_*`, ni versionar `.env.local`.

```powershell
npm ci
Copy-Item .env.example .env.local # solo si todavía no existe
# Editar .env.local con la URL correcta
npx expo start -c
```

## Verificaciones

```powershell
npm run check:arch
npm test
npx tsc --noEmit
npm run test:registration
npm run test:login
npm run test:profile
npm run test:session
npm run test:onboarding
npm run test:api-errors
```

Las pruebas automatizadas usan dobles aislados; las pruebas HTTP reales requieren un backend local disponible. Los scripts `smoke-*` y `verify-p7-live.cjs` se mantienen para esas comprobaciones. Los smoke pueden crear cuentas de desarrollo. No ejecutar contra producción.

##  Equipo

| Integrante | Rol |
|---|---|
| Nataly Huaiquinao Sáez | Scrum Master — INFO1173 |
| Sebastián Salamanca | |
| Cristian Wigand |  |
| Martín Vallejo |  |
