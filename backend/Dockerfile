# Imagen del backend SmartPlant (API REST + WebSocket)
FROM node:20-alpine

# iproute2 -> comando tc (netem) | iperf3 -> pruebas de red | curl -> diagnósticos
RUN apk add --no-cache iproute2 iperf3 curl

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src

ENV PORT=3000
EXPOSE 3000
CMD ["node", "src/server.js"]
