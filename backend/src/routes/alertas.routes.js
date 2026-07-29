const express = require('express');
const { pool } = require('../config/db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/alertas -> lista todas las alertas (con filtro opcional por tipo)
router.get('/', verificarToken, async (req, res) => {
  const { tipo } = req.query; // Error | Advertencia | Correcta | Info

  try {
    let query = `
      SELECT a.*, d.nombre_dispositivo
      FROM alertas a
      INNER JOIN dispositivos d ON d.id = a.dispositivo_id
    `;
    const valores = [];

    if (tipo && tipo !== 'Todos') {
      query += ' WHERE a.tipo = ?';
      valores.push(tipo);
    }

    query += ' ORDER BY a.creado_en DESC LIMIT 100';

    const [rows] = await pool.query(query, valores);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
});

// GET /api/alertas/resumen -> conteo por tipo (para las tarjetitas de arriba)
router.get('/resumen', verificarToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT tipo, COUNT(*) AS cantidad
      FROM alertas
      GROUP BY tipo
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener resumen de alertas' });
  }
});

// PATCH /api/alertas/:id/leida -> marcar como leída
router.patch('/:id/leida', verificarToken, async (req, res) => {
  try {
    await pool.query('UPDATE alertas SET leida = TRUE WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Alerta marcada como leída' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar alerta' });
  }
});

module.exports = router;
