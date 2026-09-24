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

```
Taller-de-Integracion-IV/
│
├── src/                        # Código fuente de la aplicación
│   ├── app/                    # Rutas y pantallas (Expo Router)
│   │   ├── _layout.tsx         # Layout raíz de la navegación
│   │   ├── index.tsx           # Pantalla de inicio (Home)
│   │   └── explore.tsx         # Pantalla de ejemplo del template
│   ├── components/             # Componentes reutilizables de UI
│   │   └── ui/                 # Sub-componentes genéricos
│   ├── constants/               # Constantes (colores, tema, config)
│   │   └── theme.ts
│   ├── hooks/                    # Hooks personalizados de React
│   └── global.css                 # Estilos globales (NativeWind)
│
├── assets/                      # Íconos, splash screen, imágenes
├── scripts/                      # Scripts de utilidad
│   └── reset-project.js          # Resetea la app a un estado limpio
│
├── .vscode/                       # Configuración de VS Code del equipo
├── .claude/                        # Configuración de asistente de IA
│
├── app.json                         # Configuración de la app (nombre, ícono, splash)
├── package.json                      # Dependencias y scripts del proyecto
├── package-lock.json                  # Versión exacta de cada dependencia
├── tsconfig.json                       # Configuración de TypeScript
├── .gitignore                           # Archivos ignorados por Git
├── AGENTS.md                             # Guía de contexto para agentes de IA
├── CLAUDE.md                              # Contexto del proyecto para Claude Code
└── LICENSE                                 # Licencia del proyecto
```

### Descripción de las carpetas clave

- **`src/app/`** — Pantallas de la app, con navegación basada en archivos (Expo Router). Cada pantalla nueva del proyecto (registro de signos vitales, historial, recordatorios, perfil) se agrega aquí.
- **`src/components/`** — Componentes de interfaz reutilizados en más de una pantalla (botones, tarjetas, badges de alerta). Evita duplicar UI entre pantallas.
- **`src/constants/`** — Valores fijos del proyecto: colores del tema, paleta de alertas (verde/amarillo/rojo), tamaños de fuente.
- **`src/hooks/`** — Lógica reutilizable (ej. un hook para consumir la API o manejar la sesión del usuario).
- **`assets/`** — Solo recursos estáticos, sin código.

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

> **Nota de compatibilidad:** el proyecto usa **Expo SDK 54** para asegurar compatibilidad con la versión de Expo Go disponible actualmente en las tiendas de aplicaciones.

##  Equipo

| Integrante | Rol |
|---|---|
| Nataly Huaiquinao Sáez | Scrum Master — INFO1173 |
| Sebastián Salamanca | |
| Cristian Wigand |  |
| Martín Vallejo |  |