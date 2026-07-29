const { pool } = require('../config/db');

/**
 * Restringe una ruta a usuarios con suscripción Premium activa.
 *
 * Importante: el JWT (req.usuario) NO lleva el estado Premium, a propósito,
 * porque ese estado puede cambiar en cualquier momento (ej. justo después de
 * un pago) sin que el usuario tenga que volver a iniciar sesión. Por eso acá
 * siempre se consulta el estado actual directo en MySQL.
 */
async function verificarPremium(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const [usuarios] = await pool.query(
      'SELECT es_premium, premium_hasta FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );
    const usuario = usuarios[0];

    const premiumVigente =
      usuario &&
      Boolean(usuario.es_premium) &&
      (!usuario.premium_hasta || new Date(usuario.premium_hasta) > new Date());

    if (!premiumVigente) {
      return res.status(403).json({
        error: 'Esta función es exclusiva para usuarios Premium',
        codigo: 'PREMIUM_REQUERIDO'
      });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar el estado de la suscripción' });
  }
}

module.exports = { verificarPremium };
