# Arquitectura de la app

La app sigue **arquitectura limpia (clean architecture) por capas, organizada por módulos que
representan funcionalidades de la aplicación**. Varios módulos pueden consumir el mismo microservicio; la lógica se puede probar sin la interfaz ni el servidor.

```
app/                         Rutas y layouts de Expo Router; las pantallas viven en los módulos.
src/
  core/                      Núcleo compartido por todos los módulos
    domain/                  Contratos compartidos y errores normalizados
    application/session/     Sesión en memoria y estado global (usuario, paciente, permisos)
    infrastructure/
      config/                URL del API Gateway (EXPO_PUBLIC_API_URL)
      http/                  Cliente HTTP: token, renovación ante 401, timeout, 204, correlación
        errors/              Adaptación de errores de HTTP
        data/                Cliente con caché y reintentos
      storage/               Tokens (SecureStore en el celular, sessionStorage en la web)
    presentation/session/    Contexto y hook de React del estado global
  modules/
    identity/                ↔ acceso
    relationships/           ↔ acceso
    monitoring/              ↔ clínico
    evaluation/              ↔ clínico
    notifications/           ↔ notificaciones
    dashboard/               Inicio: combina datos de varios módulos (sin microservicio propio)
    medical-care/            Atención médica y documentos (sin datos simulados)
  shared/presentation/       Componentes de UI, tema y hooks visuales comunes
composition/configure/        Registro de dependencias
composition/routes/           Puntos de entrada de presentación con inyección
tests/architecture/           Reglas estáticas y ausencia de código obsoleto
tests/contracts/              Contratos y adaptadores con respuestas controladas
tests/functional/             Casos de uso, controladores y vistas
tests/fixtures/               Datos y tipos históricos de pruebas
scripts/check-architecture.cjs   Verifica las reglas de este documento (npm run check:arch)
```

## Módulos y microservicios

| Módulo          | Microservicio   | Endpoints (vía API Gateway)                                                        |
|-----------------|-----------------|------------------------------------------------------------------------------------|
| `identity`      | acceso          | `/auth/*`, `/me`, `/patients/{id}`                                                  |
| `relationships` | acceso          | `/me/patients`, `/patients/{id}/caregivers` y `/doctors`, `/caregiver-relationships/*`, `/doctor-relationships/*`, `/link-codes/*` |
| `monitoring`    | clínico         | `/patients/{id}/readings`, `/patients/{id}/measurements`, `/clinical-parameters`, `/health-conditions`, `/parameter-limits` |
| `evaluation`    | clínico         | `/patients/{id}/alerts`                   |
| `notifications` | notificaciones  | `/notifications`                                                                    |

## Las cuatro capas de cada módulo

```
src/modules/<módulo>/
  domain/          Entidades y reglas puras. No sabe de HTTP, React ni almacenamiento.
  application/     ports/, use-cases/, flows/, errors/, validation/ según responsabilidad.
                   No depende de React (se prueba con npm test).
  infrastructure/  Adaptadores hacia afuera: endpoints del microservicio (*-api.ts),
                   conversión de la respuesta del backend al modelo de la app, almacenamiento local.
  presentation/    Componentes y hooks de React del módulo.
```

Un módulo solo tiene las capas que necesita (por ejemplo, `dashboard` tiene `application` y `presentation`).

### Ejemplo: alertas (`evaluation`)

| Capa             | Archivo                                    | Qué hace                                         |
|------------------|--------------------------------------------|--------------------------------------------------|
| `domain`         | `domain/alert.ts`                          | `PatientAlert` y el contrato `AlertsService`     |
| `infrastructure` | `infrastructure/api/alerts-api.ts`             | `GET/POST /patients/{id}/alerts` y conversión de la respuesta |
| `application`    | `application/use-cases/patient-alerts.ts`            | Controlador: filtros, contadores, marcar leída, errores |
| `presentation`   | `presentation/components/alerts-view.tsx`  | Tarjetas, filtros y estados vacíos               |
| pantalla         | `app/(tabs)/alertas.tsx`                   | Delega en composition/routes/alerts-route.tsx |

El controlador recibe el adaptador como parámetro (`createPatientAlerts(service)`). Por eso las
pruebas le pasan un repositorio controlado sin cambiar el controlador.

## Reglas de dependencia

Las flechas apuntan hacia adentro: la interfaz depende de la lógica, y la lógica no depende de
la interfaz.

| Capa             | Puede importar                                         | No puede importar            |
|------------------|--------------------------------------------------------|------------------------------|
| `domain`         | `domain` | `application`, `infrastructure`, `presentation` |
| `application`    | `domain`, `application` | `infrastructure`, `presentation` |
| `infrastructure` | `domain`, `infrastructure` | `application`, `presentation` |
| `presentation`   | `domain`, `application`, `presentation` | `infrastructure` |
| `core`, `shared` | Capas permitidas de `core` y `shared` | Módulos funcionales |

Las reglas se aplican también a las dependencias hacia Core y a las importaciones de tipos.
La composición conecta los adaptadores reales; las capas internas reciben los contratos.
Las rutas no importan infraestructura directamente. Los puntos de entrada autorizados
(`app/_layout.tsx`, `app/(tabs)/alertas.tsx`, `app/(auth)/login.tsx` y `app/configuracion.tsx`)
pueden importar la composición.
Ninguna capa interna importa rutas, composición, scripts ni fixtures de pruebas.

`npm run check:arch` analiza `src/`, `app/` y `composition/` mediante el AST de TypeScript.
Comprueba imports, reexports, imports de tipos y llamadas literales a `import()` y `require()`.
Resuelve las rutas relativas y el alias `@/`, y falla ante dependencias prohibidas o destinos
locales de código no resueltos. Informa las dependencias entre módulos y los ciclos del grafo
local y falla también ante ciclos; la prueba `tests/architecture/clean-architecture-final.test.cjs` comprueba esas reglas.
No es un análisis de ejecución: los imports construidos dinámicamente, la resolución de plugins
externos y la corrección del comportamiento del backend requieren otras verificaciones.

## Cómo agregar un endpoint nuevo

1. Identificar el microservicio dueño del endpoint (la tabla de arriba o `gateway/main.py` del backend).
2. Agregar la función en `src/modules/<módulo>/infrastructure/api/<módulo>-api.ts`, usando `apiClient`.
3. Si devuelve un modelo nuevo, definirlo en `domain/` y convertir la respuesta en `infrastructure/`.
4. Usarlo desde un caso de uso o controlador en `application/` (recibiéndolo por parámetro).
5. Mostrarlo con componentes en `presentation/` y conectarlo en la pantalla de `app/`.
6. Agregar pruebas en `tests/` y correr `npm test` y `npm run check:arch`.

## Imports

- Alias `@/` = raíz del proyecto: `import { apiClient } from '@/src/core/infrastructure/http/api-client'`.
- Algunos archivos (`core/infrastructure/http/errors`, `tests/fixtures/demo/demo-store`,
  `modules/identity/application/use-cases/registration`…) usan imports **relativos** a propósito: los scripts
  de `scripts/` los compilan con `tsc` sin el alias. Al editarlos, mantenerlos relativos.

## Composición y alcance actual

`composition/configure/` conecta los puertos de sesión, identidad, relaciones, seguimiento, notificaciones y dashboard con adaptadores reales. Las rutas especiales de login, alertas y configuración delegan en `composition/routes/`. Monitoring contiene los contratos de registro y catálogo y el DTO de lectura. Core mantiene los contratos transversales y una única clase de error. Las fixtures históricas no se importan desde producción.

El backend conserva el Gateway y cuatro microservicios: acceso (identidad y relaciones), clínico (seguimiento, evaluación y atención médica), notificaciones y auditoría. Dashboard combina datos de otros módulos y no tiene microservicio propio. El módulo medical-care actualmente contiene presentación; no inventa documentos. Las condiciones asignadas aún no se consumen desde la app. Push sigue pendiente.

La validación estática no reemplaza las pruebas contra el servidor real. Ejecutar `npm run check:arch`, `npm test` y `npx tsc --noEmit` antes de cerrar cambios.
