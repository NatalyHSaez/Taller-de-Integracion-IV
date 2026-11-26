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

# Crear directorios de caché que nginx necesita (Kubero usa read-only FS)
RUN mkdir -p /tmp/nginx/client_temp /tmp/nginx/proxy_temp \
             /tmp/nginx/fastcgi_temp /tmp/nginx/uwsgi_temp \
             /tmp/nginx/scgi_temp && \
    chown -R nginx:nginx /tmp/nginx

# Copiar el build estático al directorio de nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración de nginx para SPA (redirige rutas al index.html)
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
