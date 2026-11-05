# SmartPlant en Kubernetes: guía paso a paso (GitHub Codespaces)

Esta guía no necesita virtualización en tu PC: todo corre en una máquina Linux de GitHub
(Codespaces) desde el navegador. Se usa **kind** (Kubernetes in Docker) para crear un
clúster de 3 nodos.

## Arquitectura desplegada

```
Navegador(es) ──► Service frontend (NodePort 30080) ──► 2 pods nginx + React
                                                         │  /api y /ws
                                                         ▼
                                   Service backend (ClusterIP) ──► 3 pods Node.js (API + WebSocket)
                                                         │                 │
                                   Service mysql ◄───────┘                 └──► Service redis (Pub/Sub)
                                   1 pod MySQL 8 + volumen persistente          1 pod Redis
ESP32 / scripts/06-lectura.sh ──► POST /api/lecturas
Pruebas: pod k6 (carga), pod iperf3-server (red), tc/netem dentro de los pods backend
```

¿Por qué Redis? Con 3 réplicas, cada pod del backend solo conoce a SUS clientes WebSocket.
Si la lectura del ESP32 llega al pod A, un navegador conectado al pod B no la vería.
Redis Pub/Sub reenvía el evento a las 3 réplicas. Si Redis cae, cada pod sigue
funcionando, pero solo avisa a sus propios clientes.

## Archivos agregados al proyecto

| Archivo | Para qué |
|---|---|
| `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` | Contenedores |
| `k8s/kind-config.yaml` | Clúster de 3 nodos |
| `k8s/00..06-*.yaml` | Namespace, Secret, MySQL, Redis, Backend (3 réplicas), Frontend (2 réplicas), iperf3 |
| `scripts/01..07-*.sh` | Comandos listos para cada prueba |
| `backend/src/config/websocket.js` | Redis Pub/Sub + nombre del pod en los mensajes |
| `backend/src/server.js` | Encabezado `X-Pod` (qué réplica respondió) |

---

## Paso 0: abrir Codespaces (5 min)

1. Sube estos archivos a tu repositorio, o súbelos directamente en el Codespace (paso 3).
2. En GitHub abre tu repositorio y ve a **Code → Codespaces → `...` → New with options**.
   Elige **4-core** si aparece (2-core también funciona, pero más lento).
3. Si no subiste los archivos al repo: arrastra `smartplant-k8s.zip` al panel de archivos
   de la izquierda y en la terminal ejecuta:
   ```bash
   unzip -o smartplant-k8s.zip && rm smartplant-k8s.zip
   chmod +x scripts/*.sh
   ```

## Paso 1: instalar y desplegar (10–15 min)

```bash
scripts/01-instalar.sh
scripts/02-desplegar.sh
```

Cuando termine, abre la pestaña **PORTS** (abajo) → puerto **8080** → icono del globo.
Esa es tu aplicación.

### Capturas para "Despliegue en Kubernetes"
```bash
docker images | grep smartplant                 # Contenedores utilizados
kubectl get nodes -o wide                        # 3 nodos del clúster
kubectl -n smartplant get deployments            # Deployments
kubectl -n smartplant get pods -o wide           # Pods (columna NODE: repartidos en nodos)
kubectl -n smartplant get svc                    # Services
kubectl -n smartplant describe deploy backend | head -30   # Réplicas 3/3
curl -si http://localhost:8080/api/health        # Evidencia de funcionamiento
```
Repite 5 veces `curl -si http://localhost:8080/api/health | grep -i x-pod`: verás distintos
nombres de pod, que es la evidencia del **balanceo entre réplicas**.

## Paso 2: comunicación en tiempo real con múltiples clientes

1. Crea una cuenta en la app (Registro) y entra al Dashboard en **2 o 3 pestañas o navegadores**.
2. En cada pestaña abre DevTools (F12) → **Network → WS → /ws → Messages**. El primer
   mensaje dice `"pod": "backend-xxxx"`, así ves a qué réplica se conectó cada cliente.
3. En la terminal simula el ESP32:
   ```bash
   scripts/06-lectura.sh 10
   ```
   Todas las pestañas se actualizan a la vez, aunque estén en pods distintos. En los mensajes
   `nueva_lectura`, el campo `origen` indica qué pod recibió la lectura.
4. **Experimento para el informe:** `scripts/07-resiliencia.sh redis` (Ctrl+C para salir),
   y vuelve a ejecutar `scripts/06-lectura.sh 5`: ahora solo se actualizan las pestañas
   conectadas al mismo pod que recibió la lectura. Restaura con `scripts/07-resiliencia.sh redis-on`.
5. Logs: `kubectl -n smartplant logs -l app=backend --prefix --tail=20`

Mensajes intercambiados: `conexion` (al conectar), `nueva_lectura` (cada lectura), `alerta`
(humedad baja).

## Paso 3: rendimiento con k6 (dentro del clúster)

```bash
scripts/03-token.sh            # crea usuario de prueba y guarda el JWT
scripts/04-k6.sh 10 normal
scripts/04-k6.sh 25 normal
scripts/04-k6.sh 50 normal
```
Cada resultado muestra: tiempo medio, **p(95)**, **tasa de errores** y **solicitudes por segundo**.
Se guarda en `resultados/`. (Opcional: `DURATION=30s scripts/04-k6.sh 25 normal` para ir más rápido.)

## Paso 4: resiliencia

Terminal 1 (monitor que ya tenías):
```bash
cd backend && npm install && cd performance/resilience
node monitor.js --target api=http://localhost:8080/api/health \
  --target bd=http://localhost:8080/api/lecturas/actual --token $(cat ../../../.token) \
  --websocket ws=ws://localhost:8080/ws --output results/k8s-backend.csv
```
Terminal 2 (botón **+** de la terminal):
```bash
scripts/07-resiliencia.sh backend    # 1 pod: el servicio NO debería caer (quedan 2 réplicas)
scripts/07-resiliencia.sh todos      # los 3 pods: caída corta, Kubernetes los recrea solo
scripts/07-resiliencia.sh mysql      # cae la BD: /lecturas falla, /health sigue OK; los datos persisten (PVC)
```
Con Ctrl+C detienes el monitor y obtienes el `.summary.json` con el tiempo de recuperación.
Captura `kubectl -n smartplant get pods -w` mostrando `Terminating` → `ContainerCreating` → `Running`.

## Paso 5: análisis de red (iperf3 + tc/netem)

Las reglas se aplican a los **3 pods del backend** (su tráfico hacia MySQL, Redis, nginx y k6).

```bash
# 1) Condición normal
scripts/05-red.sh normal
scripts/05-red.sh iperf normal
scripts/05-red.sh ping normal
scripts/04-k6.sh 25 red-normal

# 2) Latencia (+150 ms)
scripts/05-red.sh latencia
scripts/05-red.sh iperf latencia
scripts/05-red.sh ping latencia
scripts/04-k6.sh 25 red-latencia

# 3) Pérdida de paquetes (10 %)
scripts/05-red.sh perdida
scripts/05-red.sh iperf perdida
scripts/05-red.sh ping perdida
scripts/04-k6.sh 25 red-perdida

# 4) Volver a normal (¡no olvidar!)
scripts/05-red.sh normal
```
Con latencia activa, abre el dashboard y ejecuta `scripts/06-lectura.sh 3`: las lecturas
tardan más en aparecer. Esa es la evidencia del efecto sobre el tiempo real.

Tabla sugerida para el informe:

| Condición | iperf3 (Mbits/s) | ping a MySQL (ms) | k6 p(95) (ms) | k6 errores (%) | k6 req/s |
|---|---|---|---|---|---|
| Normal | | | | | |
| Latencia 150 ms | | | | | |
| Pérdida 10 % | | | | | |

> Si `tc` responde *"Specified qdisc kind is unknown"*, el kernel de esa máquina no tiene netem.
> Usa el playground **Ubuntu** de https://killercoda.com/playgrounds (trae Docker; la sesión
> dura 1 hora): sube el zip y ejecuta los mismos scripts desde `01-instalar.sh`.

## Ideas para el análisis

- **Rendimiento + red:** la latencia añadida se multiplica, porque cada petición hace varias idas y
  vueltas a MySQL; por eso el p(95) sube más de 150 ms. La pérdida provoca retransmisiones TCP,
  lo que reduce mucho el ancho de banda de iperf3 y genera picos de p(95).
- **Resiliencia:** con 3 réplicas, perder 1 pod no afecta la disponibilidad. Si se pierden todos,
  hay unos segundos de caída hasta que pasan los readiness probes. MySQL es un punto único de
  falla (1 sola réplica).
- **Tiempo real:** sin un bus de mensajes (Redis), escalar el backend rompe el broadcast del
  WebSocket. El cliente reintenta la conexión cada 3 s (`useWebSocket.js`) al caer su pod.
- **Seguridad:** las credenciales van en un Secret de Kubernetes y no en el código; los Services
  internos (MySQL y Redis) son ClusterIP, sin acceso desde fuera del clúster.

## Limpiar
```bash
kind delete cluster --name smartplant
```
Detén el Codespace al terminar (github.com/codespaces) para no gastar horas gratis.
