const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Verifica que la petición tenga un JWT válido en el header Authorization.
 * Formato esperado: "Authorization: Bearer <token>"
 */
function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, correo, rol }
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * Middleware adicional para restringir acceso según rol.
 * Uso: verificarRol(['Administrador'])
 */
function verificarRol(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
}

/**
 * Verifica la API key que envía el ESP32 (en vez de JWT, ya que el
 * dispositivo no inicia sesión como un usuario).
 */
const { pool } = require('../config/db');

async function verificarApiKeyDispositivo(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key no proporcionada' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM dispositivos WHERE api_key = ?',
      [apiKey]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'API key inválida' });
    }

    req.dispositivo = rows[0];
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Error verificando dispositivo' });
  }
}

module.exports = { verificarToken, verificarRol, verificarApiKeyDispositivo };
