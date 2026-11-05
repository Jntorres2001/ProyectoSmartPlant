const os = require('os');
const WebSocket = require('ws');

let wss = null;

// Nombre del pod (en Kubernetes el hostname es el nombre del pod).
const NOMBRE_POD = os.hostname();

// ----------------------------------------------------------------------
// Redis Pub/Sub (opcional)
// Con varias réplicas del backend, cada pod solo conoce a SUS clientes
// WebSocket. Si una lectura llega al pod A, los dashboards conectados al
// pod B no la verían. Redis reparte el evento a todas las réplicas.
// Si REDIS_URL no está definida o Redis cae, se envía solo a los clientes
// locales (comportamiento original).
// ----------------------------------------------------------------------
const CANAL_REDIS = 'smartplant:eventos';
let publicador = null;

async function inicializarRedis() {
  if (!process.env.REDIS_URL) {
    console.log('ℹ️ REDIS_URL no definida: WebSocket solo para clientes de este proceso');
    return;
  }

  const { createClient } = require('redis');
  const pub = createClient({ url: process.env.REDIS_URL });
  const sub = pub.duplicate();

  pub.on('error', (e) => console.error('⚠️ Redis (pub):', e.message));
  sub.on('error', (e) => console.error('⚠️ Redis (sub):', e.message));

  publicador = pub;
  await pub.connect();
  await sub.connect();
  await sub.subscribe(CANAL_REDIS, (mensaje) => difundirLocal(mensaje));
  console.log(`✅ Redis Pub/Sub conectado (${process.env.REDIS_URL})`);
}

/**
 * Inicializa el servidor WebSocket sobre el mismo servidor HTTP de Express.
 */
function inicializarWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado al WebSocket (pod ${NOMBRE_POD}, total ${wss.clients.size})`);

    socket.send(JSON.stringify({
      tipo: 'conexion',
      mensaje: 'Conectado al servidor SmartPlant en tiempo real',
      pod: NOMBRE_POD
    }));

    socket.on('close', () => {
      console.log(`🔌 Cliente desconectado del WebSocket (pod ${NOMBRE_POD})`);
    });
  });

  inicializarRedis().catch((e) => console.error('⚠️ No se pudo iniciar Redis:', e.message));

  console.log('✅ WebSocket inicializado en /ws');
  return wss;
}

/** Envía un mensaje ya serializado a los clientes conectados a ESTE pod. */
function difundirLocal(mensaje) {
  if (!wss) return;
  wss.clients.forEach((cliente) => {
    if (cliente.readyState === WebSocket.OPEN) {
      cliente.send(mensaje);
    }
  });
}

/**
 * Envía un mensaje a TODOS los clientes conectados (todos los dashboards
 * abiertos), en cualquier réplica. Se usa cuando llega una nueva lectura del ESP32.
 */
function emitirATodos(tipo, datos) {
  if (!wss) return;

  const mensaje = JSON.stringify({ tipo, datos, origen: NOMBRE_POD });

  if (publicador && publicador.isReady) {
    publicador.publish(CANAL_REDIS, mensaje).catch(() => difundirLocal(mensaje));
  } else {
    difundirLocal(mensaje);
  }
}

module.exports = { inicializarWebSocket, emitirATodos };
