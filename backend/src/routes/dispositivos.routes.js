const express = require('express');
const { pool } = require('../config/db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/dispositivos -> lista de dispositivos
router.get('/', verificarToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM dispositivos');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener dispositivos' });
  }
});

// PUT /api/dispositivos/:id -> actualizar configuración (nombre, intervalo, límites, riego automático)
router.put('/:id', verificarToken, async (req, res) => {
  const { nombre_dispositivo, ssid, intervalo_lectura_segundos, humedad_minima_alerta, riego_automatico } =
    req.body;

  try {
    await pool.query(
      `UPDATE dispositivos
       SET nombre_dispositivo = COALESCE(?, nombre_dispositivo),
           ssid = COALESCE(?, ssid),
           intervalo_lectura_segundos = COALESCE(?, intervalo_lectura_segundos),
           humedad_minima_alerta = COALESCE(?, humedad_minima_alerta),
           riego_automatico = COALESCE(?, riego_automatico)
       WHERE id = ?`,
      [nombre_dispositivo, ssid, intervalo_lectura_segundos, humedad_minima_alerta, riego_automatico, req.params.id]
    );
    res.json({ mensaje: 'Configuración actualizada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar dispositivo' });
  }
});

module.exports = router;
