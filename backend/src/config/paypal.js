require('dotenv').config();

/**
 * Helper mínimo para hablar con la API REST de PayPal (v2 Orders) usando
 * fetch nativo de Node, sin depender del SDK oficial.
 *
 * Variables de entorno usadas:
 *   PAYPAL_CLIENT_ID
 *   PAYPAL_CLIENT_SECRET
 *   PAYPAL_MODE = 'sandbox' | 'live'
 */
function obtenerBaseUrlPaypal() {
  return process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function obtenerAccessTokenPaypal() {
  const baseUrl = obtenerBaseUrlPaypal();
  const credenciales = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const respuesta = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credenciales}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!respuesta.ok) {
    const texto = await respuesta.text();
    throw new Error(`Error obteniendo access token de PayPal: ${texto}`);
  }

  const datos = await respuesta.json();
  return datos.access_token;
}

module.exports = { obtenerBaseUrlPaypal, obtenerAccessTokenPaypal };
