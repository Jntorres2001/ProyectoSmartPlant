const express = require('express');
const { verificarToken } = require('../middleware/auth');
const { obtenerHistorial } = require('../services/colaCorreos.service');

const router = express.Router();

// ----------------------------------------
// GET /api/notificaciones?limite=50
// Devuelve el historial de la cola de correos: destinatario, tipo, estado, fecha.
// ----------------------------------------
router.get('/', verificarToken, async (req, res) => {
  try {
    const historial = await obtenerHistorial({ limite: req.query.limite || 50 });
    res.json(historial);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el historial de notificaciones' });
  }
});

module.exports = router;
