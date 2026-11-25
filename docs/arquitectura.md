# Arquitectura de la app

La app sigue **arquitectura limpia (clean architecture) por capas, organizada por módulos que
corresponden a los microservicios del backend**. Así, cuando cambia un microservicio, en la app
se toca solo su módulo, y la lógica se puede probar sin la interfaz ni el servidor.

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
    identity/                ↔ microservicio identidad
    relationships/           ↔ microservicio relaciones
    monitoring/              ↔ microservicio seguimiento
    evaluation/              ↔ microservicio evaluacion
    notifications/           ↔ microservicio notificaciones
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
| `identity`      | identidad       | `/auth/*`, `/me`, `/patients/{id}`                                                  |
| `relationships` | relaciones      | `/me/patients`, `/patients/{id}/caregivers` y `/doctors`, `/caregiver-relationships/*`, `/doctor-relationships/*`, `/link-codes/*` |
| `monitoring`    | seguimiento     | `/patients/{id}/readings`, `/patients/{id}/measurements`, `/clinical-parameters`, `/health-conditions` |
| `evaluation`    | evaluacion      | `/patients/{id}/alerts` (y `/parameter-limits`, ver excepciones)                   |
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

## Excepciones conocidas y próximos pasos

La validación final ya analiza las dependencias hacia Core, las rutas y las fixtures. Los puertos y modelos compartidos todavía preservan algunas formas del contrato anterior por compatibilidad; no se agregan endpoints nuevos.

### Composición del estado global

`composition/configure/configure-app-state.ts` conecta el puerto `AppStateDependencies` con los adaptadores reales y se importa desde `app/_layout.tsx` antes de restaurar la sesión. La carpeta `composition/` queda fuera de las capas internas a propósito. `app-state.ts` no importa el módulo de relaciones ni la caché HTTP; las pruebas pueden inyectar sus propias implementaciones. `auth-session.ts` recibe ahora la invalidación del transporte mediante `configureAuthSession`.

### Composición de identidad

`composition/configure/configure-identity.ts` configura el puerto `IdentityDependencies`, conecta el almacenamiento y transporte reales, y registra los callbacks de renovación e invalidación de sesión. `auth-service.ts` y `profile.ts` consumen el puerto; el formulario registra mediante `authService`. La ficha recibe su adaptador por parámetro. Los contratos compartidos y errores se reorganizaron en el Grupo 10.

### Composición de relaciones

`composition/configure/configure-relationships.ts` conecta `RelationshipsRepository` con el adaptador HTTP real. Los casos de uso de códigos, listados y gestión de vínculos usan ese puerto. Los modelos se encuentran en `domain/relationships.ts`; el adaptador conserva reexportaciones de tipos para compatibilidad. Las rutas de vínculos e invitación y la tarjeta de médico ya no importan el adaptador directamente. Las dependencias de dashboard y monitoring hacia relaciones se resolverán en sus respectivos grupos. Los errores HTTP compartidos se reorganizaron en el Grupo 10.

### Composición de seguimiento (grupo 5)

`MonitoringRepository` separa los casos de uso de registro, confirmación, catálogos y nombres de personas vinculadas del transporte HTTP. `composition/configure/configure-monitoring.ts` conecta `monitoringApi` y los casos de uso de relaciones. Los filtros, límites técnicos y rutas existentes se conservan. Historial y gráficos se reorganizaron en el Grupo 6, las pantallas en el Grupo 9 y los contratos y errores de Core en el Grupo 10.

### Consultas de lecturas (grupo 6)

`ReadingQueryRepository` separa las consultas frescas de historial, detalle y gráficos del transporte. La composición de seguimiento registra el adaptador; los modelos y el mapper se ubican en dominio. Los adaptadores anteriores conservan reexportaciones por compatibilidad. Las pantallas usan el puerto sin importar el adaptador; la lógica visual y filtros existentes se conservan. Las rutas se reorganizaron en el Grupo 9 y los errores compartidos en el Grupo 10.

### Notificaciones internas (grupo 7)

El contrato `NotificationsApi` permanece en dominio. `notifications-port.ts` registra el repositorio y la raíz `composition/configure/configure-notifications.ts` conecta el adaptador HTTP. El hook observa la sesión de Core y delega en aplicación. Las rutas de Expo Router reexportan las pantallas de presentación. Se conserva la lectura manual y la paginación; se verifica también la generación de sesión antes de mostrar datos o refrescar tras marcar. No se incorpora push ni se modifica el contrato HTTP. Los adaptadores demo y errores Core se reorganizaron en el Grupo 10.

### Dashboard (grupo 8)

`HomeSummaryDeps` y `home-summary-port.ts` permiten configurar las consultas de mediciones, alertas y permisos desde `composition/configure/configure-dashboard.ts`. La pantalla se mueve a `dashboard/presentation/screens/home-screen.tsx`; la ruta reexporta el componente. Se conserva la lógica de presentación y se limpian los datos del resumen si la actualización devuelve 401 o 403. Los modelos de lectura y alerta se comparten mediante tipos de dominio; los errores Core y las fixtures se reorganizaron en el Grupo 10.

### Grupo 9: pantallas y rutas
Las rutas de Expo Router delegan en pantallas de presentación de los módulos; los layouts mantienen la navegación. Perfil y ficha usan el puerto de identidad. Configuración recibe el diagnóstico P7 por composición en su ruta. Documentos no muestra archivos ficticios ni incorpora endpoints sin contrato. Los errores y contratos compartidos de Core se reorganizaron en el Grupo 10; la revisión final de responsabilidades queda en el Grupo 11.

### Grupo 10: limpieza de producción
El módulo demo y los adaptadores ficticios salen de `src/`. El código histórico requerido por pruebas se conserva bajo `tests/fixtures/demo`, sin importaciones desde producción. Los scripts activos apuntan a esas fixtures. `core/domain/contracts` contiene los tipos compartidos utilizados por las capas internas; los DTO HTTP mantienen reexportaciones de compatibilidad y los tipos exclusivos de transporte. `core/domain/errors` contiene una clase ApiError única y la normalización de valores simples; la lectura de objetos Response permanece en infraestructura. El diagnóstico del Gateway se inyecta a la pantalla de login desde su ruta. La normalización de payloads históricos y los tipos de lectura legados se conservan temporalmente para no romper los contratos existentes.

### Grupo 11: validación final

El verificador ampliado analiza 168 archivos productivos de la copia acumulada de los grupos 1–10: cero infracciones y cero ciclos locales detectados. Las cuatro nuevas pruebas comprueban el código real, el rechazo de dependencias indebidas, la extracción de imports y la detección de ciclos y destinos inexistentes. Las referencias entre módulos a modelos y casos de uso permitidos se conservan: no es necesario eliminar toda colaboración entre módulos.

Antes de cerrar la tarea ejecutar `npm run check:arch`, `npm test`, `npx tsc --noEmit` y las pruebas específicas de identidad y seguridad. Comprobar también la aplicación con Expo y el backend real. La revisión estática no certifica por sí sola toda la arquitectura ni los flujos de ejecución.


## Depuración complementaria

Las rutas de alertas, login y configuración delegan en componentes de `composition/`; ninguna ruta importa infraestructura directamente. El verificador devuelve error también ante ciclos locales. El detalle de lectura utiliza un único componente visual de producción, probado directamente. Se retiraron los modelos históricos de severidad y el tipo antiguo queda solo en una fixture. Los scripts históricos se conservan en el historial de Git; los guiones activos se mantienen. No se modifican los endpoints ni se añaden cálculos clínicos.

## Grupo 13 — Organización interna

`composition/configure/` registra dependencias y `composition/routes/` contiene los puntos de entrada que requieren composición. Los módulos separan `application/ports/`, `application/use-cases/`, `application/flows/`, `application/errors/` y `application/validation/` según corresponda. Los adaptadores HTTP se encuentran en `infrastructure/api/`. Monitoring posee sus contratos de registro y catálogo en `domain/contracts/` y su DTO real de lectura en `infrastructure/dto/`. Core conserva solo contratos compartidos de sesión, identificadores, salud del Gateway y errores; las solicitudes de cuenta pertenecen a Identity. Los contratos históricos que solo usan fixtures se encuentran en `tests/fixtures/contracts/`, sin referencias desde producción. Se elimina el método de detalle legado sin consumidores; el detalle real sigue en el repositorio de consultas. Las pruebas se agrupan en `architecture/`, `contracts/` y `functional/` (estas últimas incluyen pruebas de vistas y casos de uso). No se cambian las rutas HTTP ni el diseño de las pantallas.
