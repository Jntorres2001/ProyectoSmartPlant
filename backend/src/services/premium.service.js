const { pool } = require('../config/db');
const { encolarCorreo } = require('./colaCorreos.service');
const { premiumTemplate } = require('../templates/emailTemplates');

const DIAS_SUSCRIPCION = 30;

/**
 * Activa (o renueva) la suscripción Premium de un usuario después de un
 * pago aprobado (PayPhone o PayPal) y encola el correo de confirmación.
 */
async function activarPremium({ usuarioId, proveedor }) {
  const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [usuarioId]);
  const usuario = usuarios[0];
  if (!usuario) throw new Error('Usuario no encontrado al activar Premium');

  const fechaInicio = new Date();
  const fechaFin = new Date(fechaInicio.getTime() + DIAS_SUSCRIPCION * 24 * 60 * 60 * 1000);

  await pool.query(
    `UPDATE usuarios SET es_premium = TRUE, premium_hasta = ? WHERE id = ?`,
    [fechaFin, usuarioId]
  );

  await pool.query(
    `INSERT INTO suscripciones (usuario_id, plan, proveedor_pago, fecha_inicio, fecha_fin, activa)
     VALUES (?, 'Premium', ?, ?, ?, TRUE)`,
    [usuarioId, proveedor, fechaInicio, fechaFin]
  );

  await encolarCorreo({
    destinatario: usuario.correo,
    asunto: '🎉 Tu suscripción Premium está activa - SmartPlant',
    tipo: 'PREMIUM',
    html: premiumTemplate({
      nombre: usuario.nombre,
      plan: 'Premium',
      fechaFin: fechaFin.toLocaleDateString('es-ES')
    })
  });

  return { fechaInicio, fechaFin };
}

module.exports = { activarPremium };
