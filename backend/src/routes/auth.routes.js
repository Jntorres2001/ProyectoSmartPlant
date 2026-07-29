const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../config/db');
const { encolarCorreo } = require('../services/colaCorreos.service');
const { otpTemplate, recuperacionTemplate } = require('../templates/emailTemplates');
require('dotenv').config();

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const OTP_EXPIRACION_MINUTOS = 10;
const RESET_EXPIRACION_MINUTOS = 30;

function generarCodigoOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
}

async function generarYEnviarOtp(usuario) {
  const codigo = generarCodigoOtp();
  const expiraEn = new Date(Date.now() + OTP_EXPIRACION_MINUTOS * 60 * 1000);

  await pool.query(
    `INSERT INTO otp_codigos (usuario_id, codigo, expira_en) VALUES (?, ?, ?)`,
    [usuario.id, codigo, expiraEn]
  );

  await encolarCorreo({
    destinatario: usuario.correo,
    asunto: 'Tu código de verificación - SmartPlant',
    tipo: 'OTP',
    html: otpTemplate({ nombre: usuario.nombre, codigo, minutosExpiracion: OTP_EXPIRACION_MINUTOS })
  });
}

// Genera las iniciales para el avatar, ej. "Maria Garcia" -> "MG"
function generarIniciales(nombre) {
  return nombre
    .split(' ')
    .map((palabra) => palabra[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, correo: usuario.correo, rol: usuario.rol, nombre: usuario.nombre },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ----------------------------------------
// POST /api/auth/registro
// ----------------------------------------
router.post('/registro', async (req, res) => {
  const { nombre, correo, password } = req.body;

  if (!nombre || !correo || !password) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
  }

  try {
    const [existentes] = await pool.query('SELECT id FROM usuarios WHERE correo = ?', [correo]);
    if (existentes.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    }

    const hashPassword = await bcrypt.hash(password, 10);
    const iniciales = generarIniciales(nombre);

    const [resultado] = await pool.query(
      `INSERT INTO usuarios (nombre, correo, password, rol, avatar_iniciales)
       VALUES (?, ?, ?, 'Visualizador', ?)`,
      [nombre, correo, hashPassword, iniciales]
    );

    const usuario = { id: resultado.insertId, nombre, correo, rol: 'Visualizador', avatar: iniciales, esPremium: false };
    const token = generarToken(usuario);

    // Genera y encola el correo de verificación OTP (no bloquea el registro si falla)
    try {
      await generarYEnviarOtp(usuario);
    } catch (errorOtp) {
      console.error('⚠️ No se pudo encolar el correo OTP de verificación:', errorOtp.message);
    }

    res.status(201).json({ token, usuario, requiereVerificacion: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// ----------------------------------------
// POST /api/auth/verificar-otp
// Body: { correo, codigo }
// ----------------------------------------
router.post('/verificar-otp', async (req, res) => {
  const { correo, codigo } = req.body;

  if (!correo || !codigo) {
    return res.status(400).json({ error: 'Correo y código son obligatorios' });
  }

  try {
    const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
    const usuario = usuarios[0];
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const [otps] = await pool.query(
      `SELECT * FROM otp_codigos
       WHERE usuario_id = ? AND codigo = ? AND usado = FALSE AND expira_en > NOW()
       ORDER BY creado_en DESC LIMIT 1`,
      [usuario.id, codigo]
    );

    if (otps.length === 0) {
      return res.status(400).json({ error: 'Código OTP inválido o expirado' });
    }

    await pool.query('UPDATE otp_codigos SET usado = TRUE WHERE id = ?', [otps[0].id]);
    await pool.query('UPDATE usuarios SET correo_verificado = TRUE WHERE id = ?', [usuario.id]);

    res.json({ mensaje: 'Correo verificado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar el código OTP' });
  }
});

// ----------------------------------------
// POST /api/auth/reenviar-otp
// Body: { correo }
// ----------------------------------------
router.post('/reenviar-otp', async (req, res) => {
  const { correo } = req.body;
  if (!correo) return res.status(400).json({ error: 'El correo es obligatorio' });

  try {
    const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
    const usuario = usuarios[0];
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (usuario.correo_verificado) {
      return res.status(400).json({ error: 'Este correo ya está verificado' });
    }

    await generarYEnviarOtp(usuario);
    res.json({ mensaje: 'Código OTP reenviado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al reenviar el código OTP' });
  }
});

// ----------------------------------------
// POST /api/auth/forgot-password
// Body: { correo }
// Siempre responde 200 (aunque el correo no exista) para no filtrar
// qué correos están registrados en el sistema.
// ----------------------------------------
router.post('/forgot-password', async (req, res) => {
  const { correo } = req.body;
  if (!correo) return res.status(400).json({ error: 'El correo es obligatorio' });

  try {
    const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
    const usuario = usuarios[0];

    if (usuario) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiraEn = new Date(Date.now() + RESET_EXPIRACION_MINUTOS * 60 * 1000);

      await pool.query(
        `INSERT INTO password_resets (usuario_id, token, expira_en) VALUES (?, ?, ?)`,
        [usuario.id, token, expiraEn]
      );

      const urlReset = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/restablecer-contrasena?token=${token}`;

      await encolarCorreo({
        destinatario: usuario.correo,
        asunto: 'Recupera tu contraseña - SmartPlant',
        tipo: 'RECUPERACION',
        html: recuperacionTemplate({ nombre: usuario.nombre, urlReset, minutosExpiracion: RESET_EXPIRACION_MINUTOS })
      });
    }

    res.json({ mensaje: 'Si el correo existe, recibirás un enlace de recuperación en breve' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar la solicitud de recuperación' });
  }
});

// ----------------------------------------
// POST /api/auth/reset-password
// Body: { token, password }
// ----------------------------------------
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token y nueva contraseña son obligatorios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const [resets] = await pool.query(
      `SELECT * FROM password_resets WHERE token = ? AND usado = FALSE AND expira_en > NOW()`,
      [token]
    );

    if (resets.length === 0) {
      return res.status(400).json({ error: 'El enlace de recuperación es inválido o ha expirado' });
    }

    const reset = resets[0];
    const hashPassword = await bcrypt.hash(password, 10);

    await pool.query('UPDATE usuarios SET password = ? WHERE id = ?', [hashPassword, reset.usuario_id]);
    await pool.query('UPDATE password_resets SET usado = TRUE WHERE id = ?', [reset.id]);

    res.json({ mensaje: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
});

// ----------------------------------------
// POST /api/auth/login
// ----------------------------------------
router.post('/login', async (req, res) => {
  const { correo, password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
    const usuario = rows[0];

    if (!usuario || !usuario.password) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (usuario.estado === 'Inactivo') {
      return res.status(403).json({ error: 'Esta cuenta está inactiva' });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generarToken(usuario);
    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        avatar: usuario.avatar_iniciales,
        esPremium: Boolean(usuario.es_premium),
        premiumHasta: usuario.premium_hasta
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// ----------------------------------------
// POST /api/auth/google
// El frontend manda el "id_token" que obtiene del botón de Google.
// ----------------------------------------
router.post('/google', async (req, res) => {
  const { id_token } = req.body;

  if (!id_token) {
    return res.status(400).json({ error: 'Falta el id_token de Google' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload(); // { sub, email, name, picture, ... }

    let [rows] = await pool.query('SELECT * FROM usuarios WHERE google_id = ? OR correo = ?', [
      payload.sub,
      payload.email
    ]);

    let usuario = rows[0];

    if (!usuario) {
      // Primera vez que este usuario entra con Google -> lo creamos
      const iniciales = generarIniciales(payload.name);
      const [resultado] = await pool.query(
        `INSERT INTO usuarios (nombre, correo, google_id, rol, avatar_iniciales)
         VALUES (?, ?, ?, 'Visualizador', ?)`,
        [payload.name, payload.email, payload.sub, iniciales]
      );
      usuario = {
        id: resultado.insertId,
        nombre: payload.name,
        correo: payload.email,
        rol: 'Visualizador'
      };
    } else if (!usuario.google_id) {
      // Usuario existente que ahora vincula su cuenta con Google
      await pool.query('UPDATE usuarios SET google_id = ? WHERE id = ?', [payload.sub, usuario.id]);
    }

    const token = generarToken(usuario);
    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        esPremium: Boolean(usuario.es_premium),
        premiumHasta: usuario.premium_hasta
      }
    });
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: 'Token de Google inválido' });
  }
});

module.exports = router;
