const express = require('express');
const { pool } = require('../config/db');
const { verificarToken, verificarApiKeyDispositivo } = require('../middleware/auth');
const { emitirATodos } = require('../config/websocket');
const { encolarCorreo } = require('../services/colaCorreos.service');
const { alertaTemplate } = require('../templates/emailTemplates');
const { generarRecomendacionAutomatica } = require('../services/asistenteIA.service');

const router = express.Router();

// ----------------------------------------
// POST /api/lecturas
// El ESP32 llama este endpoint cada X segundos con su lectura.
// Header requerido: x-api-key
// Body: { humedad, voltaje, senal_wifi }
// (Este proyecto usa únicamente un sensor capacitivo de humedad; no existe
// sensor de temperatura en el hardware)
// ----------------------------------------
router.post('/', verificarApiKeyDispositivo, async (req, res) => {
  const { humedad, voltaje, senal_wifi } = req.body;
  const dispositivo = req.dispositivo;

  if (humedad === undefined) {
    return res.status(400).json({ error: 'El campo humedad es obligatorio' });
  }

  try {
    // Determina el estado de la planta según el límite configurado
    let estadoPlanta = 'Saludable';
    if (humedad < dispositivo.humedad_minima_alerta) {
      estadoPlanta = humedad < dispositivo.humedad_minima_alerta - 10 ? 'Critico' : 'Necesita agua';
    }

    // Guarda la lectura
    const [resultado] = await pool.query(
      `INSERT INTO lecturas (dispositivo_id, humedad, voltaje, senal_wifi, estado_planta)
       VALUES (?, ?, ?, ?, ?)`,
      [dispositivo.id, humedad, voltaje ?? null, senal_wifi ?? null, estadoPlanta]
    );

    // Marca el dispositivo como conectado
    await pool.query(
      `UPDATE dispositivos SET estado = 'Conectado', ultima_conexion = NOW() WHERE id = ?`,
      [dispositivo.id]
    );

    // Si la humedad está baja, genera una alerta automática
    if (estadoPlanta !== 'Saludable') {
      await pool.query(
        `INSERT INTO alertas (dispositivo_id, tipo, titulo, mensaje)
         VALUES (?, 'Advertencia', 'Humedad baja detectada', ?)`,
        [dispositivo.id, `Nivel de humedad cayó a ${humedad}%. La planta necesita riego.`]
      );

      emitirATodos('alerta', {
        dispositivo: dispositivo.nombre_dispositivo,
        humedad,
        estadoPlanta
      });

      // Envía un correo de alerta al dueño del dispositivo (si tiene uno asignado
      // y no ha desactivado las notificaciones por correo)
      if (dispositivo.usuario_id) {
        try {
          const [[dueño]] = await pool.query(
            `SELECT u.correo, u.nombre
             FROM usuarios u
             LEFT JOIN notificaciones_config nc ON nc.usuario_id = u.id
             WHERE u.id = ? AND (nc.correo IS NULL OR nc.correo = TRUE)`,
            [dispositivo.usuario_id]
          );

          if (dueño) {
            await encolarCorreo({
              destinatario: dueño.correo,
              asunto: `⚠ Alerta de humedad - ${dispositivo.nombre_dispositivo}`,
              tipo: 'ALERTA',
              html: alertaTemplate({
                nombreDispositivo: dispositivo.nombre_dispositivo,
                humedad,
                estadoPlanta,
                fecha: new Date().toLocaleString('es-ES')
              })
            });
          }
        } catch (errorCorreoAlerta) {
          console.error('⚠️ No se pudo encolar el correo de alerta:', errorCorreoAlerta.message);
        }
      }
    }

    const lectura = {
      id: resultado.insertId,
      dispositivo_id: dispositivo.id,
      dispositivo: dispositivo.nombre_dispositivo,
      humedad,
      voltaje,
      senal_wifi,
      estadoPlanta,
      creado_en: new Date().toISOString()
    };

    // 🔥 Esto es lo que hace que el Panel Principal se actualice SIN recargar la página
    emitirATodos('nueva_lectura', lectura);

    // Genera una recomendación con IA en segundo plano (solo si el dueño es
    // Premium). No se espera (no "await") a propósito, para no retrasar la
    // respuesta al ESP32 con una llamada a Ollama.
    generarRecomendacionAutomatica(dispositivo).catch((error) => {
      console.error('⚠️ No se pudo generar la recomendación automática de IA:', error.message);
    });

    res.status(201).json({ mensaje: 'Lectura guardada', lectura });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar la lectura' });
  }
});

// ----------------------------------------
// GET /api/lecturas/actual
// Devuelve la última lectura de cada dispositivo (para el Dashboard)
// ----------------------------------------
router.get('/actual', verificarToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT l.*, d.nombre_dispositivo, d.estado AS estado_dispositivo
      FROM lecturas l
      INNER JOIN dispositivos d ON d.id = l.dispositivo_id
      WHERE l.id IN (
        SELECT MAX(id) FROM lecturas GROUP BY dispositivo_id
      )
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la lectura actual' });
  }
});

// ----------------------------------------
// GET /api/lecturas/historial?dispositivo_id=1&desde=...&hasta=...&pagina=1
// ----------------------------------------
router.get('/historial', verificarToken, async (req, res) => {
  const { dispositivo_id, desde, hasta } = req.query;
  const pagina = parseInt(req.query.pagina) || 1;
  const limite = parseInt(req.query.limite) || 10;
  const offset = (pagina - 1) * limite;

  try {
    let condiciones = [];
    let valores = [];

    if (dispositivo_id) {
      condiciones.push('l.dispositivo_id = ?');
      valores.push(dispositivo_id);
    }
    if (desde) {
      condiciones.push('l.creado_en >= ?');
      valores.push(desde);
    }
    if (hasta) {
      condiciones.push('l.creado_en <= ?');
      valores.push(hasta);
    }

    const whereClause = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT l.*, d.nombre_dispositivo
       FROM lecturas l
       INNER JOIN dispositivos d ON d.id = l.dispositivo_id
       ${whereClause}
       ORDER BY l.creado_en DESC
       LIMIT ? OFFSET ?`,
      [...valores, limite, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM lecturas l ${whereClause}`,
      valores
    );

    res.json({ datos: rows, total, pagina, totalPaginas: Math.ceil(total / limite) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el historial' });
  }
});

module.exports = router;
