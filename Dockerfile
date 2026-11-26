# ── Etapa 1: build de Expo Web ────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar dependencias primero para aprovechar caché de capas
COPY package.json package-lock.json ./
RUN npm ci

# Copiar el resto del proyecto
COPY . .

# Generar el build estático de la versión web
RUN npx expo export --platform web

# ── Etapa 2: servir con nginx ─────────────────────────────────────
FROM nginx:alpine

# Copiar el build estático al directorio de nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración de nginx para SPA (redirige rutas al index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
