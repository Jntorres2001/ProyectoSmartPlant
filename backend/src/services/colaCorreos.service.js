const { pool } = require('../config/db');

/**
 * Cola interna de correos, respaldada 100% en MySQL (sin Redis/RabbitMQ).
 * Cualquier parte del backend que necesite mandar un correo simplemente
 * llama a `encolarCorreo(...)`. El Worker (workers/emailWorker.js) revisa
 * la tabla `cola_correos` cada segundo y procesa lo que esté en PENDING.
 *
 * adjuntos: array opcional en formato Nodemailer, ej:
 *   [{ filename: 'reporte.pdf', content: bufferOBase64, contentType: 'application/pdf' }]
 * Los buffers se guardan como base64 dentro del JSON para poder persistirlos en MySQL.
 */
async function encolarCorreo({ destinatario, asunto, tipo = 'GENERAL', html, adjuntos = [] }) {
  if (!destinatario || !asunto || !html) {
    throw new Error('destinatario, asunto y html son obligatorios para encolar un correo');
  }

  const adjuntosSerializados = adjuntos.map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    contentBase64: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content
  }));

  const [resultado] = await pool.query(
    `INSERT INTO cola_correos (destinatario, asunto, tipo, cuerpo_html, adjuntos, estado)
     VALUES (?, ?, ?, ?, ?, 'PENDING')`,
    [destinatario, asunto, tipo, html, JSON.stringify(adjuntosSerializados)]
  );

  console.log(`📥 Correo encolado (id=${resultado.insertId}, tipo=${tipo}, para=${destinatario})`);
  return resultado.insertId;
}

async function obtenerHistorial({ limite = 50 } = {}) {
  const [rows] = await pool.query(
    `SELECT id, destinatario, asunto, tipo, estado, intentos, error, creado_en, actualizado_en
     FROM cola_correos
     ORDER BY creado_en DESC
     LIMIT ?`,
    [Number(limite)]
  );
  return rows;
}

module.exports = { encolarCorreo, obtenerHistorial };
