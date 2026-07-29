const { pool } = require('../config/db');
const { transporter } = require('../config/mailer');

let emitirNotificacion = () => {};
try {
  // Se referencia de forma perezosa para evitar dependencias circulares
  ({ emitirATodos: emitirNotificacion } = require('../config/websocket'));
} catch (_) {
  /* noop */
}

const INTERVALO_MS = 1000; // procesa la cola cada segundo
const MAX_INTENTOS = 3;
let procesando = false; // evita solapar ejecuciones si un envío tarda más de 1s

/**
 * Toma el próximo correo PENDING (el más antiguo), lo marca como PROCESSING
 * y trata de enviarlo. Actualiza el estado final a SENT o FAILED.
 */
async function procesarSiguienteCorreo() {
  if (procesando) return;
  procesando = true;

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    // FOR UPDATE + SKIP LOCKED evita que dos workers tomen el mismo correo
    const [rows] = await conexion.query(
      `SELECT * FROM cola_correos WHERE estado = 'PENDING' ORDER BY creado_en ASC LIMIT 1 FOR UPDATE`
    );

    if (rows.length === 0) {
      await conexion.commit();
      return;
    }

    const correo = rows[0];
    await conexion.query(`UPDATE cola_correos SET estado = 'PROCESSING' WHERE id = ?`, [correo.id]);
    await conexion.commit();

    console.log(`⚙️  [Worker] Procesando correo id=${correo.id} → ${correo.destinatario} (${correo.tipo})`);

    try {
      // mysql2 ya deserializa las columnas JSON automáticamente, así que
      // `correo.adjuntos` puede llegar como array/objeto o, en algunas
      // configuraciones, como string. Soportamos ambos casos.
      const adjuntosRaw = correo.adjuntos;
      const adjuntosParseados =
        typeof adjuntosRaw === 'string'
          ? JSON.parse(adjuntosRaw || '[]')
          : (adjuntosRaw || []);

      const adjuntos = adjuntosParseados.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.contentBase64, 'base64'),
        contentType: a.contentType
      }));

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: correo.destinatario,
        subject: correo.asunto,
        html: correo.cuerpo_html,
        attachments: adjuntos
      });

      await pool.query(`UPDATE cola_correos SET estado = 'SENT', error = NULL WHERE id = ?`, [correo.id]);
      console.log(`✅ [Worker] Correo id=${correo.id} enviado correctamente a ${correo.destinatario}`);
    } catch (errorEnvio) {
      const intentos = correo.intentos + 1;
      const estadoFinal = intentos >= MAX_INTENTOS ? 'FAILED' : 'PENDING';

      await pool.query(
        `UPDATE cola_correos SET estado = ?, intentos = ?, error = ? WHERE id = ?`,
        [estadoFinal, intentos, errorEnvio.message, correo.id]
      );

      console.error(
        `❌ [Worker] Error enviando correo id=${correo.id} (intento ${intentos}/${MAX_INTENTOS}): ${errorEnvio.message}`
      );
    }

    emitirNotificacion('notificacion_actualizada', { id: correo.id });
  } catch (errorGeneral) {
    console.error('❌ [Worker] Error inesperado procesando la cola de correos:', errorGeneral.message);
    try { await conexion.rollback(); } catch (_) { /* noop */ }
  } finally {
    conexion.release();
    procesando = false;
  }
}

function iniciarWorkerDeCorreos() {
  console.log(`🚀 Worker de correos iniciado (revisa la cola cada ${INTERVALO_MS / 1000}s)`);
  setInterval(procesarSiguienteCorreo, INTERVALO_MS);
}

module.exports = { iniciarWorkerDeCorreos };
