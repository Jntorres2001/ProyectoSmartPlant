const express = require('express');
const { pool } = require('../config/db');
const { verificarToken } = require('../middleware/auth');
const { encolarCorreo } = require('../services/colaCorreos.service');
const { reporteTemplate } = require('../templates/emailTemplates');
const { generarGraficoHumedadSvg } = require('../utils/generarGraficoHumedadSvg');
const { generarReportePdf } = require('../utils/generarReportePdf');

const router = express.Router();

// ----------------------------------------
// POST /api/reportes/enviar
// Body: { dispositivo_id?, desde?, hasta? }
// Genera un PDF + gráfico de humedad y los envía por correo (vía la cola)
// al usuario autenticado.
// ----------------------------------------
router.post('/enviar', verificarToken, async (req, res) => {
  const { dispositivo_id, desde, hasta } = req.body;

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

    const [lecturas] = await pool.query(
      `SELECT l.*, d.nombre_dispositivo
       FROM lecturas l
       INNER JOIN dispositivos d ON d.id = l.dispositivo_id
       ${whereClause}
       ORDER BY l.creado_en ASC
       LIMIT 500`,
      valores
    );

    if (lecturas.length === 0) {
      return res.status(404).json({ error: 'No hay lecturas para el rango/dispositivo seleccionado' });
    }

    const nombreDispositivo = lecturas[0].nombre_dispositivo;
    const rango = desde || hasta
      ? `${desde ? new Date(desde).toLocaleDateString('es-ES') : '...'} - ${hasta ? new Date(hasta).toLocaleDateString('es-ES') : 'hoy'}`
      : 'Últimas lecturas registradas';

    const graficoSvg = generarGraficoHumedadSvg(lecturas);
    const pdfBuffer = await generarReportePdf({
      dispositivo: nombreDispositivo,
      rango,
      lecturas
    });

    await encolarCorreo({
      destinatario: req.usuario.correo,
      asunto: `📊 Reporte de humedad - ${nombreDispositivo}`,
      tipo: 'REPORTE',
      html: reporteTemplate({ nombre: req.usuario.nombre, dispositivo: nombreDispositivo, rango }),
      adjuntos: [
        { filename: 'reporte_smartplant.pdf', content: pdfBuffer, contentType: 'application/pdf' },
        { filename: 'grafico_humedad.svg', content: Buffer.from(graficoSvg, 'utf-8'), contentType: 'image/svg+xml' }
      ]
    });

    res.json({ mensaje: 'El reporte se está generando y se enviará a tu correo en unos segundos' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar y enviar el reporte' });
  }
});

module.exports = router;
