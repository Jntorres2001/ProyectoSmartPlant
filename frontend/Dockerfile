# Etapa 1: compilar React con Vite
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Rutas relativas: nginx reenvía /api y /ws al Service "backend"
ENV VITE_API_URL=/api
ENV VITE_WS_URL=/ws
RUN npm run build

# Etapa 2: servir los archivos estáticos con nginx
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
