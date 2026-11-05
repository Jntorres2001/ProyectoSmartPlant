# Análisis de resiliencia de SmartPlant

Esta carpeta contiene un monitor externo para registrar disponibilidad HTTP/WebSocket, detectar
interrupciones y medir el tiempo entre la detección del primer fallo y la primera respuesta válida.
No apaga procesos, no cambia configuración del backend y no ejecuta escrituras en MySQL.

## Arquitectura revisada

- Express, REST y WebSocket comparten el mismo servidor HTTP y puerto (`PORT`, predeterminado 3000).
- `GET /api/health` devuelve `estado: ok`, pero no consulta MySQL. Un 200 en este endpoint no prueba
  que la base de datos esté disponible.
- `GET /api/lecturas/actual` requiere `Authorization: Bearer <JWT>` y ejecuta una consulta MySQL;
  es el objetivo de solo lectura usado para observar la dependencia de la base.
- Al arrancar, el backend pide una conexión MySQL antes de `server.listen`. Si esa conexión inicial
  falla, el código termina el proceso. Las consultas fallidas durante la ejecución retornan 500
  desde sus manejadores de rutas.
- El pool MySQL está configurado con `connectionLimit: 10`. La recuperación al volver MySQL debe
  medirse; este monitor no presupone un resultado.
- El frontend WebSocket usa `/ws` en el mismo servidor y reintenta conectar al cerrar el socket cada
  3 segundos. El monitor verifica el mensaje inicial `{"tipo":"conexion", ...}`.

## Requisitos

- Node.js 18 o posterior (usa `fetch` integrado).
- Para sondeos WebSocket: dependencias del backend instaladas (`npm install` en `backend`), incluida
  la dependencia existente `ws`.
- Backend SmartPlant y MySQL locales/de prueba. Para medir rutas privadas, un JWT válido.

## Ejecutar en Windows PowerShell

Desde la raíz `smartplant`:

```powershell
Set-Location .\backend\performance\resilience
New-Item -ItemType Directory -Force .\results | Out-Null
```

### 1. Línea base y caída/reinicio del backend

Inicia SmartPlant normalmente en otra terminal y confirma el mensaje de escucha. Inicia el monitor
con ambos protocolos y deja que recoja una línea base durante al menos 30 segundos:

```powershell
node .\monitor.js `
  --target health=http://localhost:3000/api/health `
  --websocket realtime=ws://localhost:3000/ws `
  --interval-ms 1000 `
  --output .\results\backend-restart.csv
```

Mientras el monitor corre, detén el backend **manualmente en la terminal donde lo iniciaste**
(`Ctrl+C`). Déjalo detenido el intervalo planeado y reinícialo con `npm run dev` o `npm start`,
manteniendo MySQL activo. El monitor debe registrar fallos y luego la transición a recuperado. Para
terminarlo y generar el resumen, presiona `Ctrl+C` en la terminal del monitor.

El resumen incluye disponibilidad observada (sondeos exitosos / total), intervalos de interrupción
y `recoveryMs` desde el primer sondeo fallido hasta el primer exitoso. La resolución temporal está
limitada por el intervalo de sondeo y el timeout. `GET /api/health` evalúa backend; el sondeo
WebSocket evalúa el upgrade y el mensaje de bienvenida.

### 2. Interrupción y recuperación de MySQL

Primero inicia el backend con MySQL en funcionamiento y obtén un JWT válido en la aplicación. En una
terminal aparte, inicia estos sondeos (no requiere tocar ni insertar datos):

```powershell
$jwtSeguro = Read-Host "Pega un JWT válido" -AsSecureString
$env:TOKEN = [System.Net.NetworkCredential]::new("", $jwtSeguro).Password
Remove-Variable jwtSeguro
node .\monitor.js `
  --target health=http://localhost:3000/api/health `
  --target mysql-read=http://localhost:3000/api/lecturas/actual `
  --websocket realtime=ws://localhost:3000/ws `
  --interval-ms 1000 `
  --output .\results\mysql-outage.csv
```

Con el monitor activo, provoca una interrupción controlada únicamente mediante el procedimiento
administrativo habitual de tu instancia **local/de prueba** (por ejemplo, detener e iniciar el
servicio MySQL desde Servicios de Windows o desde la herramienta con la que fue instalado). No
borres, restaures ni modifiques bases o tablas. Mantén el backend en ejecución; no cambies reglas de
firewall ni uses comandos que terminen procesos a la fuerza. Al restablecer MySQL, observa cuándo
`mysql-read` vuelve a 200. Finaliza el monitor con `Ctrl+C`.

Interpreta ambas sondas en conjunto: si `health` permanece en 200 mientras `mysql-read` falla, el
servidor HTTP sigue vivo pero la ruta que depende de MySQL no está disponible. Si el backend fue
iniciado sin conexión a MySQL, revisa su log: según `server.js`/`db.js`, la conexión inicial fallida
impide que empiece a escuchar.

### 3. Preparación para futuras réplicas

El monitor acepta varios objetivos HTTP con nombres únicos y los evalúa en paralelo. Cuando haya
réplicas accesibles individualmente, asígnales sus URLs reales y conserva una URL del balanceador:

```powershell
node .\monitor.js `
  --target balanceador=http://localhost:3000/api/health `
  --target replica-1=http://localhost:3001/api/health `
  --target replica-2=http://localhost:3002/api/health `
  --interval-ms 1000 `
  --duration-seconds 300 `
  --output .\results\replicas.csv
```

Los puertos del ejemplo son ilustrativos, no existen en la arquitectura actual. La configuración
actual ejecuta un solo proceso Node y no tiene réplicas ni balanceador. Por ello, no se puede validar
el failover hasta que Kubernetes (o réplicas equivalentes) se configure después. Compara los
objetivos para observar si el balanceador y las réplicas responden; evita interpretar una URL
compartida del balanceador como identificación de una réplica concreta.

## Evidencias

Cada ejecución crea:

- Un CSV con cada sondeo: timestamp, objetivo, protocolo, éxito, código/estado, latencia, fallo y
  tiempo de recuperación cuando se detecta.
- Un JSON `.summary.json` con disponibilidad observada, contadores y episodios de interrupción.

Los archivos se guardan bajo `results\`, que está ignorado por Git para no versionar evidencias o
tokens por accidente. Copia los archivos generados a tu carpeta de entrega solo después de revisar
que no incluyan información sensible. Registra junto a la evidencia las versiones de Node/MySQL,
el equipo, fecha, duración y la acción manual realizada. No son resultados simulados; cada resultado
debe obtenerse ejecutando el procedimiento en tu entorno.
