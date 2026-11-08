# Sistema de Acompañamiento de Salud para Adultos Mayores — App Móvil

**Curso:** INFO1173 - Taller de Integración IV

##  ¿Qué es el proyecto?

Un sistema de acompañamiento de salud que permite a cuidadores registrar y monitorear el estado de salud de adultos mayores (o personas con condiciones crónicas) a su cargo: mediciones de signos vitales, medicamentos, recordatorios y comunicación con un profesional de salud — todo compartido entre una plataforma web y una aplicación móvil que trabajan sobre el mismo backend.

**Problema que resuelve:** hoy, muchas familias llevan el control de salud de un adulto mayor en papel, WhatsApp o de memoria, perdiendo información valiosa, sin poder detectar tendencias a tiempo, ni compartir un historial ordenado con el médico tratante.

Este repositorio contiene específicamente la **aplicación móvil** (INFO1173), construida en Expo (React Native).

##  Funcionalidades principales

| Función | Descripción |
|---|---|
| Registro de signos vitales | Presión, glicemia, peso, temperatura, con alertas visuales si están fuera de rango |
| Recordatorios de medicamentos | Notificaciones de horarios de toma, con confirmación por el paciente o el cuidador |
| Historial de cambios de medicación | Auditoría de cuándo se ajustó una dosis o tratamiento |
| Roles y permisos granulares | Cuidador principal, cuidador secundario, médico (solo lectura) |
| Notas clínicas del médico | El profesional puede comentar sin editar los datos registrados |
| Modo de emergencia / contacto rápido | Botón para notificar rápidamente a cuidadores o servicios de emergencia |
| Sincronización offline-first | La app funciona sin conexión y sincroniza al recuperar señal |
| Geolocalización de servicios de salud | Mapa con consultorios/farmacias cercanas |

##  Arquitectura general
...

##  Stack tecnológico (App Móvil)

...
## 📁 Estructura de carpetas

La app sigue **arquitectura limpia por capas**, con un módulo por cada microservicio del backend.
El detalle, las reglas entre capas y cómo agregar un endpoint están en
[`docs/arquitectura.md`](docs/arquitectura.md). `npm run check:arch` verifica las reglas.

```
Taller-de-Integracion-IV/
├── app/                      # Pantallas y rutas (Expo Router)
├── src/
│   ├── core/                 # Núcleo: cliente HTTP, errores, DTO, tokens, sesión
│   ├── modules/
│   │   ├── identity/         #   ↔ identidad      (login, registro, perfil, ficha)
│   │   ├── relationships/    #   ↔ relaciones     (vínculos, permisos, códigos QR)
│   │   ├── monitoring/       #   ↔ seguimiento    (lecturas, mediciones, gráficos)
│   │   ├── evaluation/       #   ↔ evaluacion     (alertas)
│   │   ├── notifications/    #   ↔ notificaciones
│   │   ├── dashboard/        #   Inicio
│   │   └── demo/             #   Modo demostración
│   │       (cada módulo: domain/ application/ infrastructure/ presentation/)
│   └── shared/presentation/  # UI y tema comunes
├── tests/                    # Pruebas (npm test)
├── scripts/                  # Pruebas de línea de comandos y check-architecture
├── docs/                     # Documentación
└── assets/                   # Íconos, splash e imágenes
```

### Carpetas que NO se suben al repositorio

Definidas en `.gitignore`, se generan localmente al correr `npm install`:

- `node_modules/`
- `.expo/`

##  Cómo levantar el proyecto localmente

```bash
git clone https://github.com/NatalyHSaez/Taller-de-Integracion-IV.git
cd Taller-de-Integracion-IV
git checkout <nombre-de-tu-rama>
git pull origin main
npm install
npm run start
```

Escanea el código QR con la app **Expo Go** desde tu celular, o presiona `w` para abrirlo en el navegador.

### Conexión con el backend local

La aplicación funciona sin configuración adicional cuando el backend se ejecuta en el mismo computador:

- Expo Web usa `http://localhost:8000`.
- Android Emulator usa `http://10.0.2.2:8000`.

Para usar **Expo Go en un teléfono físico**, crea un archivo `.env.local` a partir del ejemplo:

```powershell
Copy-Item .env.example .env.local
```

Ejecuta `ipconfig`, busca la dirección IPv4 del computador que ejecuta el backend y reemplaza el valor del archivo:

```env
EXPO_PUBLIC_API_URL=http://192.168.X.X:8000
```

Después reinicia Expo y vuelve a cargar la aplicación:

```powershell
npx expo start --clear
```

El teléfono y el computador deben estar en la misma red. El backend debe aceptar conexiones externas (por ejemplo, escuchando en `0.0.0.0`) y el firewall debe permitir el puerto `8000`. El archivo `.env.local` es personal, está ignorado por Git y no debe subirse al repositorio.

> **Nota de compatibilidad:** el proyecto usa **Expo SDK 54** para asegurar compatibilidad con la versión de Expo Go disponible actualmente en las tiendas de aplicaciones.

##  Equipo

| Integrante | Rol |
|---|---|
| Nataly Huaiquinao Sáez | Scrum Master — INFO1173 |
| Sebastián Salamanca | |
| Cristian Wigand |  |
| Martín Vallejo |  |
