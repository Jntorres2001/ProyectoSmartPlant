# 🌱 SmartPlant — Maceta Inteligente con IoT

Sistema completo de monitoreo de humedad para plantas usando ESP32 + sensor capacitivo,
backend en Node.js con WebSocket en tiempo real, y dashboard web en React.

## 📁 Estructura del proyecto

```
smartplant/
├── backend/        # API Node.js + Express + MySQL + JWT + WebSocket
├── firmware/       # Código Arduino para el ESP32
└── frontend/       # Dashboard web en React
```

---

## 🗄️ Paso 1: Base de datos MySQL

1. Asegúrate de tener MySQL instalado y corriendo.
2. Crea la base de datos ejecutando el script incluido:

```bash
mysql -u root -p < backend/database.sql
```

Esto crea la base `smartplant` con todas las tablas (usuarios, dispositivos, lecturas, alertas)
y un dispositivo de ejemplo `ESP32-Jardin-01` con la API key `sp_demo_apikey_cambiala_123456`.

> ⚠️ **Cambia esa API key** antes de usarla en producción. Puedes editarla directamente en la tabla `dispositivos`.

---

## ⚙️ Paso 2: Backend (Node.js)

```bash
cd backend
npm install
cp .env.example .env
```

Edita `.env` con tus datos reales:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password_mysql
DB_NAME=smartplant
JWT_SECRET=una_clave_larga_y_aleatoria
GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret
```

### Configurar Google OAuth (para "Continuar con Google")
1. Ve a [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Crea credenciales OAuth 2.0 de tipo "Aplicación web".
3. En "Orígenes de JavaScript autorizados" agrega: `http://localhost:5173`
4. Copia el `Client ID` y `Client Secret` a tu `.env` (backend) y al `.env` del frontend.

### Arrancar el servidor

```bash
npm run dev
```

Deberías ver:
```
✅ Conectado a MySQL correctamente
🌱 SmartPlant backend corriendo en http://localhost:3000
🔌 WebSocket disponible en ws://localhost:3000/ws
```

---

## 💻 Paso 3: Frontend (React + Vite)

```bash
cd frontend
npm install
cp .env.example .env
```

Edita `.env`:
```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000/ws
VITE_GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
```

```bash
npm run dev
```

Abre **http://localhost:5173** — verás la pantalla de login. Regístrate con email o usa Google.

---

## 🔌 Paso 4: Firmware ESP32

1. Abre `firmware/smartplant_esp32.ino` en Arduino IDE.
2. Instala las librerías necesarias desde el Gestor de Librerías:
   - **ArduinoJson** (by Benoit Blanchon)
   - El core de ESP32 (WiFi.h y HTTPClient.h vienen incluidas)
3. Edita estas líneas con tus datos:

```cpp
const char* WIFI_SSID     = "TU_RED_WIFI";
const char* WIFI_PASSWORD = "TU_PASSWORD_WIFI";
const char* SERVER_URL = "http://192.168.1.100:3000/api/lecturas"; // IP de tu PC
const char* API_KEY = "sp_demo_apikey_cambiala_123456"; // debe coincidir con la BD
```

> 💡 **¿Cómo saber la IP de tu PC?**
> - Windows: abre `cmd` y escribe `ipconfig`
> - Mac/Linux: abre la terminal y escribe `ifconfig` o `ip a`
> Busca la IP de tu red WiFi local (normalmente `192.168.x.x`).

### Conexión del sensor capacitivo
- **VCC** → 3.3V del ESP32
- **GND** → GND del ESP32
- **AOUT (salida analógica)** → GPIO34 del ESP32

### Calibración (importante)
El sensor capacitivo da valores ADC distintos según el modelo. Para calibrar el tuyo:
1. Sube el firmware y abre el Monitor Serie (115200 baudios).
2. Deja el sensor **seco al aire** y anota el valor que imprime → ese es `VALOR_SECO`.
3. Sumérgelo en **agua** y anota el valor → ese es `VALOR_HUMEDO`.
4. Actualiza esas dos constantes en el código y vuelve a subir el firmware.

---

## 🔄 Cómo fluye la información (resumen)

```
[Sensor capacitivo] → [ESP32 lee ADC] → [ESP32 convierte a %] 
       → [POST HTTP a /api/lecturas con x-api-key]
       → [Backend guarda en MySQL] → [Backend evalúa si hay alerta]
       → [Backend emite por WebSocket a todos los dashboards conectados]
       → [React recibe el mensaje WS] → [Dashboard se actualiza SIN recargar]
```

---

## 🔐 Roles de usuario

| Rol             | Permisos                                          |
|------------------|----------------------------------------------------|
| Administrador    | Todo: gestionar usuarios, dispositivos, alertas    |
| Tecnico          | Ver dashboard, historial, alertas, configurar ESP32|
| Visualizador     | Solo ver dashboard, historial y alertas            |

El primer usuario que se registra queda como **Visualizador** por defecto.
Para volverlo Administrador, edítalo directamente en la base de datos:

```sql
UPDATE usuarios SET rol = 'Administrador' WHERE correo = 'tu_correo@ejemplo.com';
```

---

## 🧪 Probar sin el hardware todavía

Si quieres ver el dashboard funcionando antes de tener el ESP32 conectado, puedes simular
una lectura manualmente con `curl`:

```bash
curl -X POST http://localhost:3000/api/lecturas \
  -H "Content-Type: application/json" \
  -H "x-api-key: sp_demo_apikey_cambiala_123456" \
  -d '{"humedad": 45, "temperatura": 23.5, "voltaje": 3.3, "senal_wifi": -60}'
```

Verás el dashboard actualizarse en tiempo real automáticamente gracias al WebSocket. 🎉

---

## 🛠️ Tecnologías usadas

- **Hardware:** ESP32, sensor de humedad capacitivo
- **Backend:** Node.js, Express, MySQL (mysql2), JWT, Google OAuth, WebSocket (ws)
- **Frontend:** React, Vite, React Router, Recharts
- **Firmware:** Arduino C++, ArduinoJson

## 📈 Pruebas de rendimiento con k6

El backend incluye pruebas de carga para endpoints GET de la API, con medición de tiempo de
respuesta, p(95), tasa de errores y solicitudes por segundo. Revisa
[`backend/performance/k6/README.md`](backend/performance/k6/README.md) para endpoints seleccionados,
requisitos, comandos para diferentes cantidades de usuarios virtuales y comparación de resultados.
Las pruebas no requieren cambios en las funcionalidades ni en la base de datos.

## 🛡️ Análisis de resiliencia

El monitor para observar interrupciones y recuperación del backend, WebSocket y MySQL está en
[`backend/performance/resilience/README.md`](backend/performance/resilience/README.md). Usa sondeos
de solo lectura y guarda evidencias CSV/JSON; las instrucciones para futuras réplicas son
preparatorias y no implementan contenedores ni Kubernetes.

---

## ✉️ Nuevas funcionalidades: correo, OTP, recuperación, reportes y pagos

Esta sección documenta lo agregado sobre el proyecto original. No cambia nada de lo anterior, solo se integra.

### 1. Actualiza la base de datos

Si ya tenías la base `smartplant` creada, vuelve a correr `database.sql` para agregar las tablas y
columnas nuevas (`otp_codigos`, `password_resets`, `cola_correos`, `suscripciones`,
`transacciones_pago`, y las columnas `correo_verificado`, `es_premium`, `premium_hasta` en `usuarios`):

```bash
mysql -u root -p smartplant < backend/database.sql
```

> ⚠️ Las sentencias `ALTER TABLE ... ADD COLUMN` fallarán si las corres dos veces (la columna ya
> existiría). Eso es esperado — solo corre el script una vez sobre una base ya creada.

### 2. Configura Gmail (Nodemailer)

1. Activa la verificación en 2 pasos en la cuenta de Gmail que usarás para enviar correos.
2. Genera una "contraseña de aplicación" en <https://myaccount.google.com/apppasswords>.
3. En `backend/.env` configura:

```env
EMAIL_USER=tu_correo@gmail.com
EMAIL_APP_PASSWORD=la_contraseña_de_aplicacion_de_16_caracteres
EMAIL_FROM="SmartPlant 🌱 <tu_correo@gmail.com>"
```

Al arrancar el backend verás `✅ Servidor de correo (Gmail) listo para enviar mensajes` si quedó bien
configurado.

### 3. Cola de correos y Worker

No se usa Redis ni RabbitMQ — la cola vive en la tabla `cola_correos` de MySQL. El Worker
(`backend/src/workers/emailWorker.js`) arranca automáticamente junto con el servidor
(`npm run dev` / `npm start`) y revisa la tabla cada segundo, con estados `PENDING` → `PROCESSING` →
`SENT`/`FAILED`. Verás logs como:

```
🚀 Worker de correos iniciado (revisa la cola cada 1s)
⚙️  [Worker] Procesando correo id=3 → usuario@correo.com (OTP)
✅ [Worker] Correo id=3 enviado correctamente a usuario@correo.com
```

### 4. Verificación OTP y recuperación de contraseña

- Al registrarte, se envía automáticamente un código OTP de 6 dígitos (`/verificar-otp`).
- "¿Olvidaste tu contraseña?" en el login lleva a `/olvide-contrasena` → recibes un enlace por
  correo → `/restablecer-contrasena?token=...`.
- Estas funciones **no bloquean** el login/registro existente: si el correo falla al encolarse, la
  cuenta igual se crea y puedes seguir usando la app con normalidad.

### 5. Reportes por correo (PDF + gráfico)

Desde **Historial → 📧 Enviar reporte** se genera un PDF (con el gráfico de humedad dibujado como
vector, sin dependencias nativas) y un gráfico `.svg` adicional, y ambos se adjuntan al correo vía la
cola.

### 6. Panel de Notificaciones

Nueva sección en el menú lateral: **Notificaciones**, con el historial completo de la cola de correos
(destinatario, tipo, estado, fecha), actualizado en tiempo real por WebSocket cada vez que el Worker
procesa un correo.

### 7. PayPhone y PayPal (suscripción Premium)

En `backend/.env` configura:

```env
PAYPHONE_TOKEN=
PAYPHONE_STORE_ID=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox
```

Y en `frontend/.env`:

```env
VITE_PAYPAL_CLIENT_ID=
```

Desde **Configuración → 🌟 Suscripción Premium** puedes pagar con PayPal (Sandbox) o PayPhone. Al
confirmarse el pago, el backend activa la suscripción Premium del usuario y encola el correo de
confirmación automáticamente.

> ⚠️ El pago con PayPhone usa el flujo oficial **Prepare → redirección → Confirm** de su API REST
> (`https://pay.payphonetodoesposible.com/api/button/Prepare` y `.../api/button/V2/Confirm`). El
> usuario es redirigido a la página de pago hospedada por PayPhone y, al terminar, PayPhone lo
> regresa a `/pago/payphone/retorno` en tu frontend, donde se confirma el pago automáticamente.
> No se usa ningún SDK/script embebible de terceros (se evitó a propósito, por ser un punto de falla
> frágil). Si el campo de la URL de pago en la respuesta de `Prepare` no coincide con tu cuenta,
> revisa los logs del backend — se imprime la respuesta cruda de PayPhone para ajustarlo fácilmente.

### 9. Asistente IA (exclusivo Premium, con Ollama local)

Requiere tener [Ollama](https://ollama.com) instalado y corriendo localmente, con el modelo descargado:

```bash
ollama pull qwen2.5:0.5b
ollama serve   # si no arranca automáticamente
```

En `backend/.env` (opcional, ya trae estos valores por defecto):

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:0.5b
```

- Nueva sección **"Asistente IA"** en el menú lateral, con interfaz de chat (historial, caja de
  texto, botón Enviar, indicador "La IA está escribiendo...").
- **Solo disponible para usuarios Premium.** Si un usuario FREE entra, ve una pantalla bloqueada con
  el mensaje correspondiente y un botón **"Actualizar a Premium"**. El estado Premium se valida
  siempre contra la base de datos (no contra el JWT), así que se activa al instante justo después de
  un pago aprobado, sin necesidad de volver a iniciar sesión.
- El asistente conoce el contexto de SmartPlant (riego, humedad, sensores, ESP32) y, si el usuario
  tiene un dispositivo con lecturas, también recibe en el prompt su humedad, temperatura y estado
  actuales para responder con datos reales.
- Si Ollama no está corriendo, el endpoint `/api/ai/chat` responde con un error claro indicando que
  no pudo conectarse (no rompe el resto del sistema).

### 10. Panel Principal, sin temperatura, y Asistente IA ampliado

- El **Dashboard** ahora se muestra como **"Panel Principal"** en toda la interfaz (menú, encabezados).
  La ruta interna sigue siendo `/dashboard` y el archivo sigue siendo `Dashboard.jsx` — solo cambió el
  texto visible.
- Se eliminó **todo** rastro de temperatura: columna en la base de datos (`ALTER TABLE lecturas DROP
  COLUMN temperatura`), tarjetas, gráficas, endpoints, contexto de la IA y firmware del ESP32. El
  sistema solo usa datos reales del sensor capacitivo de humedad.
- **"Analizar mi planta"** (en Asistente IA): analiza hasta 50 lecturas reales + la actual, calcula
  tendencia/salud/próximo riego de forma determinista en código (no se le pide a un modelo de 0.5B que
  haga matemáticas, solo que interprete hechos ya calculados), y genera un diagnóstico con Ollama. Se
  guarda en la nueva tabla `diagnosticos_ia`.
- **"Estado Inteligente"** (tarjeta en el Panel Principal): se actualiza en tiempo real por WebSocket
  cada vez que llega una lectura nueva del ESP32 — pero **solo genera contenido de IA real para
  usuarios Premium** (llamada a Ollama en segundo plano, sin bloquear la respuesta al ESP32). Los
  usuarios FREE ven una vista previa estática con botón "Actualizar a Premium".
- **"Recomendaciones de la IA"**: sección en el Panel Principal con las últimas recomendaciones
  automáticas generadas.
- **Diagnósticos IA** (`/diagnosticos-ia`): nueva vista con el historial completo de diagnósticos,
  protegida por Premium.
- Todo lo anterior reutiliza el sistema de autenticación, Premium y Ollama ya existentes — no se
  duplicó ninguna integración.

### 11. Requisitos adicionales

- **Node.js 18+** (se usa `fetch` nativo para hablar con las APIs de PayPhone/PayPal).
- Nuevas dependencias de backend: `nodemailer`, `pdfkit` (ver `backend/package.json`). No se agregó
  ninguna dependencia con bindings nativos (se evitó `canvas`/`chartjs-node-canvas` a propósito para
  no depender de Cairo/Pango del sistema operativo).
- Para el Asistente IA: Ollama corriendo localmente con el modelo `qwen2.5:0.5b` descargado.
