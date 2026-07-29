const WebSocket = require('ws');

let wss = null;

/**
 * Inicializa el servidor WebSocket sobre el mismo servidor HTTP de Express.
 */
function inicializarWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (socket) => {
    console.log('🔌 Cliente conectado al WebSocket');

    socket.send(JSON.stringify({
      tipo: 'conexion',
      mensaje: 'Conectado al servidor SmartPlant en tiempo real'
    }));

    socket.on('close', () => {
      console.log('🔌 Cliente desconectado del WebSocket');
    });
  });

  console.log('✅ WebSocket inicializado en /ws');
  return wss;
}

/**
 * Envía un mensaje a TODOS los clientes conectados (todos los dashboards
 * abiertos). Se usa cuando llega una nueva lectura del ESP32.
 */
function emitirATodos(tipo, datos) {
  if (!wss) return;

  const mensaje = JSON.stringify({ tipo, datos });

  wss.clients.forEach((cliente) => {
    if (cliente.readyState === WebSocket.OPEN) {
      cliente.send(mensaje);
    }
  });
}

module.exports = { inicializarWebSocket, emitirATodos };
