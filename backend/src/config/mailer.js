const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Transportador de Nodemailer usando Gmail.
 *
 * Requiere en .env:
 *   EMAIL_USER          -> tu correo de Gmail (ej. smartplant.app@gmail.com)
 *   EMAIL_APP_PASSWORD  -> una "contraseña de aplicación" generada en
 *                          https://myaccount.google.com/apppasswords
 *                          (NO tu contraseña normal de Gmail; requiere
 *                          verificación en 2 pasos activada en la cuenta)
 *   EMAIL_FROM          -> nombre + correo que verá el destinatario,
 *                          ej. "SmartPlant 🌱 <smartplant.app@gmail.com>"
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Verifica la configuración de correo al arrancar (no bloquea el servidor si falla)
function verificarTransportador() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.warn('⚠️  EMAIL_USER / EMAIL_APP_PASSWORD no están configurados. El envío de correos fallará hasta que se configuren en .env');
    return;
  }

  transporter.verify((error) => {
    if (error) {
      console.error('❌ Error de configuración de Gmail/Nodemailer:', error.message);
    } else {
      console.log('✅ Servidor de correo (Gmail) listo para enviar mensajes');
    }
  });
}

module.exports = { transporter, verificarTransportador };
