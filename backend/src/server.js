const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const { verificarConexion, asegurarTablasRecientes } = require('./config/db');
const { inicializarWebSocket } = require('./config/websocket');
const { verificarTransportador } = require('./config/mailer');
const { iniciarWorkerDeCorreos } = require('./workers/emailWorker');

const authRoutes = require('./routes/auth.routes');
const lecturasRoutes = require('./routes/lecturas.routes');
const alertasRoutes = require('./routes/alertas.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const dispositivosRoutes = require('./routes/dispositivos.routes');
const reportesRoutes = require('./routes/reportes.routes');
const notificacionesRoutes = require('./routes/notificaciones.routes');
const pagosRoutes = require('./routes/pagos.routes');
const aiRoutes = require('./routes/ai.routes');

const app = express();
const server = http.createServer(app);

// ----------------------------------------
// Middlewares globales
// ----------------------------------------
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Indica qué réplica (pod) atendió la petición; útil para evidenciar el balanceo en Kubernetes.
app.use((req, res, next) => {
  res.set('X-Pod', require('os').hostname());
  next();
});

// ----------------------------------------
// Rutas
// ----------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/lecturas', lecturasRoutes);
app.use('/api/alertas', alertasRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/dispositivos', dispositivosRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/health', (req, res) => {
  res.json({ estado: 'ok', mensaje: 'SmartPlant backend funcionando 🌱' });
});

// ----------------------------------------
// WebSocket (mismo puerto que HTTP, path /ws)
// ----------------------------------------
inicializarWebSocket(server);

// ----------------------------------------
// Arranque del servidor
// ----------------------------------------
const PORT = process.env.PORT || 3000;

(async () => {
  await verificarConexion();
  await asegurarTablasRecientes();
  verificarTransportador();
  iniciarWorkerDeCorreos();

  server.listen(PORT, () => {
    console.log(`🌱 SmartPlant backend corriendo en http://localhost:${PORT}`);
    console.log(`🔌 WebSocket disponible en ws://localhost:${PORT}/ws`);
  });
})();
