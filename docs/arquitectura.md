# Arquitectura de la app

La app sigue **arquitectura limpia (clean architecture) por capas, organizada por módulos que
corresponden a los microservicios del backend**. Así, cuando cambia un microservicio, en la app
se toca solo su módulo, y la lógica se puede probar sin la interfaz ni el servidor.

```
app/                         Pantallas y rutas (Expo Router). No se mueve: la carpeta define las URL.
src/
  core/                      Núcleo compartido por todos los módulos
    application/session/     Sesión en memoria y estado global (usuario, paciente, permisos)
    infrastructure/
      config/                URL del API Gateway (EXPO_PUBLIC_API_URL)
      http/                  Cliente HTTP: token, renovación ante 401, timeout, 204, correlación
        dto/                 Tipos del contrato del backend (camelCase)
        errors/              ApiError y normalización de errores
        data/                Cliente con caché y reintentos
      storage/               Tokens (SecureStore en el celular, localStorage en la web)
    presentation/session/    Contexto y hook de React del estado global
  modules/
    identity/                ↔ microservicio identidad
    relationships/           ↔ microservicio relaciones
    monitoring/              ↔ microservicio seguimiento
    evaluation/              ↔ microservicio evaluacion
    notifications/           ↔ microservicio notificaciones
    dashboard/               Inicio: combina datos de varios módulos (sin microservicio propio)
    demo/                    Modo demostración: adaptador en memoria que reemplaza al backend
  shared/presentation/       Componentes de UI, tema y hooks visuales comunes
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
  application/     Casos de uso y controladores de pantalla: estado, paginación, errores,
                   cambio de paciente. No dependen de React (se prueban con npm test).
  infrastructure/  Adaptadores hacia afuera: endpoints del microservicio (*-api.ts),
                   conversión de la respuesta del backend al modelo de la app, almacenamiento local.
  presentation/    Componentes y hooks de React del módulo.
```

Un módulo solo tiene las capas que necesita (por ejemplo, `dashboard` solo tiene `application`).

### Ejemplo: alertas (`evaluation`)

| Capa             | Archivo                                    | Qué hace                                         |
|------------------|--------------------------------------------|--------------------------------------------------|
| `domain`         | `domain/alert.ts`                          | `PatientAlert` y el contrato `AlertsService`     |
| `infrastructure` | `infrastructure/alerts-api.ts`             | `GET/POST /patients/{id}/alerts` y conversión de la respuesta |
| `application`    | `application/patient-alerts.ts`            | Controlador: filtros, contadores, marcar leída, errores |
| `presentation`   | `presentation/components/alerts-view.tsx`  | Tarjetas, filtros y estados vacíos               |
| pantalla         | `app/(tabs)/alertas.tsx`                   | Conecta el controlador con el adaptador y la vista |

El controlador recibe el adaptador como parámetro (`createPatientAlerts(service)`). Por eso las
pruebas le pasan un backend simulado, y el modo demo le pasa uno en memoria, sin cambiar el
controlador.

## Reglas de dependencia

Las flechas apuntan hacia adentro: la interfaz depende de la lógica, y la lógica no depende de
la interfaz.

| Capa             | Puede importar                                         | No puede importar            |
|------------------|--------------------------------------------------------|------------------------------|
| `domain`         | `domain`                                               | `application`, `infrastructure`, `presentation` |
| `application`    | `domain`, `application`, `infrastructure` (*)          | `presentation`               |
| `infrastructure` | `domain`, `infrastructure`, `core`                     | `application`, `presentation` |
| `presentation`   | todo lo anterior                                       | —                            |
| `core`           | `core`                                                 | módulos (ver excepciones)    |

(*) `application` usa la infraestructura **solo como adaptador por defecto**
(`createPatientAlerts(service = backendAlertsService)`); siempre se puede reemplazar por parámetro.

`npm run check:arch` revisa estas reglas y **falla si hay una dependencia prohibida**. También
lista las dependencias entre módulos y las excepciones conocidas, para revisarlas.

## Cómo agregar un endpoint nuevo

1. Identificar el microservicio dueño del endpoint (la tabla de arriba o `gateway/main.py` del backend).
2. Agregar la función en `src/modules/<módulo>/infrastructure/<módulo>-api.ts`, usando `apiClient`.
3. Si devuelve un modelo nuevo, definirlo en `domain/` y convertir la respuesta en `infrastructure/`.
4. Usarlo desde un caso de uso o controlador en `application/` (recibiéndolo por parámetro).
5. Mostrarlo con componentes en `presentation/` y conectarlo en la pantalla de `app/`.
6. Agregar pruebas en `tests/` y correr `npm test` y `npm run check:arch`.

## Imports

- Alias `@/` = raíz del proyecto: `import { apiClient } from '@/src/core/infrastructure/http/api-client'`.
- Algunos archivos (`core/infrastructure/http/errors`, `modules/demo/infrastructure/demo-store`,
  `modules/identity/application/registration`…) usan imports **relativos** a propósito: los scripts
  de `scripts/` los compilan con `tsc` sin el alias. Al editarlos, mantenerlos relativos.

## Excepciones conocidas y próximos pasos

Están identificadas y no rompen las reglas prohibidas, pero conviene resolverlas:

- `core/application/session/app-state.ts` usa `relationships` (lista de pacientes del cuidador) y
  el modo demo. Pendiente: inyectarlos desde `app/_layout.tsx`.
- `app/perfil.tsx` y `app/(tabs)/vinculos.tsx` llaman endpoints directamente. Pendiente: pasarlos
  por un caso de uso de `application/`.
- `monitoring/application/clinical-parameters.ts` consulta también `/parameter-limits`, que es del
  servicio de evaluación (los límites se usan para validar el registro). Pendiente: pedirlos a
  través de un adaptador de `evaluation`.
- `monitoring/application/readings.ts`, `clinical-parameters.ts` y `health-conditions.ts` todavía
  combinan la llamada HTTP con la lógica. Pendiente: separar su adaptador en `infrastructure/`,
  como ya está hecho en alertas y notificaciones.
- El modo demo se usa directamente desde varias pantallas. Pendiente: que cada módulo reciba el
  adaptador demo igual que recibe el del backend.
