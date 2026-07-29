/**
 * Plantillas HTML para los correos de SmartPlant.
 * Todas comparten un layout base con la identidad visual de la app
 * (verde #3aa05a, tipografía limpia, header con el logo 🌱).
 */

function layoutBase({ titulo, contenidoHtml, colorAcento = '#3aa05a' }) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>${titulo}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f3f6f4; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f6f4; padding: 32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
            <tr>
              <td style="background:linear-gradient(135deg, ${colorAcento}, #2f8a4c); padding: 28px 32px; text-align:left;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <span style="font-size:26px;">🌱</span>
                  <span style="color:#ffffff; font-size:18px; font-weight:700; vertical-align:middle;">SmartPlant</span>
                </div>
                <div style="color:rgba(255,255,255,0.85); font-size:11px; letter-spacing:1px; margin-top:4px;">IOT MONITOR</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                ${contenidoHtml}
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px; background:#f9fbfa; text-align:center;">
                <p style="margin:0; font-size:12px; color:#9aa79f;">
                  Este es un mensaje automático de SmartPlant. Por favor no respondas a este correo.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

function otpTemplate({ nombre, codigo, minutosExpiracion = 10 }) {
  const contenido = `
    <h2 style="margin:0 0 8px; color:#1f2d24;">Verifica tu cuenta</h2>
    <p style="color:#6b7d72; font-size:14px; margin:0 0 24px;">
      Hola ${nombre || ''}, usa este código para verificar tu correo electrónico en SmartPlant:
    </p>
    <div style="background:#f0f8f2; border:1px dashed #3aa05a; border-radius:12px; padding:20px; text-align:center; margin-bottom:24px;">
      <span style="font-size:32px; font-weight:700; letter-spacing:8px; color:#2f8a4c;">${codigo}</span>
    </div>
    <p style="color:#6b7d72; font-size:13px; margin:0;">
      Este código expira en ${minutosExpiracion} minutos. Si tú no solicitaste esto, puedes ignorar este correo.
    </p>`;
  return layoutBase({ titulo: 'Verifica tu cuenta - SmartPlant', contenidoHtml: contenido });
}

function recuperacionTemplate({ nombre, urlReset, minutosExpiracion = 30 }) {
  const contenido = `
    <h2 style="margin:0 0 8px; color:#1f2d24;">Recupera tu contraseña</h2>
    <p style="color:#6b7d72; font-size:14px; margin:0 0 24px;">
      Hola ${nombre || ''}, recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para continuar:
    </p>
    <div style="text-align:center; margin-bottom:24px;">
      <a href="${urlReset}" style="display:inline-block; background:#3aa05a; color:#ffffff; text-decoration:none; font-weight:600; font-size:14px; padding:14px 28px; border-radius:10px;">
        Restablecer contraseña
      </a>
    </div>
    <p style="color:#9aa79f; font-size:12px; word-break:break-all; margin:0 0 16px;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>${urlReset}
    </p>
    <p style="color:#6b7d72; font-size:13px; margin:0;">
      Este enlace expira en ${minutosExpiracion} minutos. Si tú no solicitaste esto, ignora este correo — tu contraseña seguirá siendo la misma.
    </p>`;
  return layoutBase({ titulo: 'Recupera tu contraseña - SmartPlant', contenidoHtml: contenido });
}

function alertaTemplate({ nombreDispositivo, humedad, estadoPlanta, fecha }) {
  const esCritico = estadoPlanta === 'Critico';
  const color = esCritico ? '#d64545' : '#d99a2b';
  const contenido = `
    <h2 style="margin:0 0 8px; color:#1f2d24;">💧 Alerta de humedad</h2>
    <p style="color:#6b7d72; font-size:14px; margin:0 0 20px;">
      Tu planta necesita atención. Estos son los detalles:
    </p>
    <table role="presentation" width="100%" style="background:#faf8f2; border-radius:12px; padding:4px; border-collapse:separate;">
      <tr>
        <td style="padding:16px 20px;">
          <div style="font-size:13px; color:#6b7d72;">Dispositivo</div>
          <div style="font-size:15px; font-weight:600; color:#1f2d24; margin-bottom:12px;">${nombreDispositivo}</div>
          <div style="font-size:13px; color:#6b7d72;">Nivel de humedad</div>
          <div style="font-size:24px; font-weight:700; color:${color}; margin-bottom:12px;">${humedad}%</div>
          <div style="font-size:13px; color:#6b7d72;">Estado</div>
          <div style="font-size:15px; font-weight:600; color:${color};">${estadoPlanta === 'Critico' ? '⚠ Crítico' : '💧 Necesita agua'}</div>
        </td>
      </tr>
    </table>
    <p style="color:#9aa79f; font-size:12px; margin:16px 0 0;">Detectado el ${fecha}</p>`;
  return layoutBase({ titulo: 'Alerta de humedad - SmartPlant', contenidoHtml: contenido, colorAcento: esCritico ? '#d64545' : '#d99a2b' });
}

function reporteTemplate({ nombre, dispositivo, rango }) {
  const contenido = `
    <h2 style="margin:0 0 8px; color:#1f2d24;">📊 Tu reporte está listo</h2>
    <p style="color:#6b7d72; font-size:14px; margin:0 0 20px;">
      Hola ${nombre || ''}, adjunto encontrarás el reporte de humedad ${dispositivo ? `del dispositivo <strong>${dispositivo}</strong>` : ''} ${rango ? `(${rango})` : ''}.
    </p>
    <div style="background:#f0f8f2; border-radius:12px; padding:18px 20px; margin-bottom:8px;">
      <div style="font-size:13px; color:#2f8a4c;">📎 Adjuntos incluidos</div>
      <div style="font-size:14px; color:#1f2d24; margin-top:4px;">• Reporte en PDF</div>
      <div style="font-size:14px; color:#1f2d24;">• Gráfico de humedad (imagen)</div>
    </div>`;
  return layoutBase({ titulo: 'Reporte SmartPlant', contenidoHtml: contenido });
}

function premiumTemplate({ nombre, plan = 'Premium', fechaFin }) {
  const contenido = `
    <h2 style="margin:0 0 8px; color:#1f2d24;">🎉 ¡Bienvenido a SmartPlant ${plan}!</h2>
    <p style="color:#6b7d72; font-size:14px; margin:0 0 20px;">
      Hola ${nombre || ''}, tu pago fue confirmado y tu suscripción ${plan} ya está activa.
    </p>
    <div style="background:#f0f8f2; border-radius:12px; padding:18px 20px; margin-bottom:16px;">
      <div style="font-size:13px; color:#6b7d72;">Plan activo</div>
      <div style="font-size:18px; font-weight:700; color:#2f8a4c;">${plan}</div>
      ${fechaFin ? `<div style="font-size:13px; color:#6b7d72; margin-top:8px;">Vigente hasta: <strong>${fechaFin}</strong></div>` : ''}
    </div>
    <p style="color:#6b7d72; font-size:13px; margin:0;">Gracias por confiar en SmartPlant para el cuidado de tus plantas. 🌱</p>`;
  return layoutBase({ titulo: 'Suscripción activada - SmartPlant', contenidoHtml: contenido });
}

module.exports = {
  otpTemplate,
  recuperacionTemplate,
  alertaTemplate,
  reporteTemplate,
  premiumTemplate
};
