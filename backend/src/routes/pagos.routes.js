const express = require('express');
const { pool } = require('../config/db');
const { verificarToken } = require('../middleware/auth');
const { obtenerBaseUrlPaypal, obtenerAccessTokenPaypal } = require('../config/paypal');
const { activarPremium } = require('../services/premium.service');

const router = express.Router();

const PLAN_PREMIUM_MONTO = process.env.PREMIUM_PRECIO_USD || '4.99';

// ============================================================
// PAYPHONE
// ============================================================

// ----------------------------------------
// POST /api/pagos/payphone/crear
// Llama al endpoint oficial "Prepare" de PayPhone y devuelve la URL de pago
// hospedada por PayPhone, a la que el frontend redirige al usuario.
//
// Se eligió este flujo (Prepare -> redirección -> Confirm) en vez de un
// widget/SDK embebible de terceros, porque depende únicamente de la API
// REST de PayPhone (estable y documentada), sin cargar ningún script
// externo que pueda fallar, cambiar de URL o ser bloqueado por el navegador.
// ----------------------------------------
router.post('/payphone/crear', verificarToken, async (req, res) => {
  try {
    const clientTransactionId = `sp-${req.usuario.id}-${Date.now()}`;
    const montoUsd = Number(req.body.monto || PLAN_PREMIUM_MONTO);
    const montoCentavos = Math.round(montoUsd * 100); // PayPhone trabaja en centavos
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const respuestaPrepare = await fetch('https://pay.payphonetodoesposible.com/api/button/Prepare', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYPHONE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: montoCentavos,
        amountWithoutTax: montoCentavos,
        amountWithTax: 0,
        tax: 0,
        service: 0,
        tip: 0,
        currency: 'USD',
        reference: 'Suscripción Premium SmartPlant',
        clientTransactionId,
        storeId: process.env.PAYPHONE_STORE_ID,
        responseUrl: `${frontendUrl}/pago/payphone/retorno`,
        cancellationUrl: `${frontendUrl}/configuracion`
      })
    });

    const datosPrepare = await respuestaPrepare.json().catch(() => ({}));

    if (!respuestaPrepare.ok) {
      return res.status(400).json({ error: 'No se pudo iniciar el pago con PayPhone', detalle: datosPrepare });
    }

    // El nombre exacto del campo con la URL de pago puede variar según la
    // versión/configuración de la cuenta PayPhone; cubrimos los nombres más
    // comunes reportados en su documentación e integraciones reales.
    const urlPago = datosPrepare.payWithCard || datosPrepare.payWithPayPhone || datosPrepare.paymentUrl || datosPrepare.url;

    if (!urlPago) {
      console.error('⚠️ PayPhone Prepare no devolvió una URL de pago reconocible:', datosPrepare);
      return res.status(502).json({
        error: 'PayPhone no devolvió una URL de pago válida. Revisa PAYPHONE_TOKEN/PAYPHONE_STORE_ID y la respuesta cruda en los logs del backend.',
        detalle: datosPrepare
      });
    }

    res.json({ urlPago, clientTransactionId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al preparar el pago con PayPhone' });
  }
});

// ----------------------------------------
// POST /api/pagos/payphone/confirmar
// Body: { id, clientTxId }  -> los devuelve el widget de PayPhone al terminar
// ----------------------------------------
router.post('/payphone/confirmar', verificarToken, async (req, res) => {
  const { id, clientTxId } = req.body;

  if (!id || !clientTxId) {
    return res.status(400).json({ error: 'id y clientTxId son obligatorios' });
  }

  try {
    const respuesta = await fetch('https://pay.payphonetodoesposible.com/api/button/V2/Confirm', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYPHONE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id, clientTxId })
    });

    const datos = await respuesta.json();

    if (!respuesta.ok || datos.transactionStatus !== 'Approved') {
      await pool.query(
        `INSERT INTO transacciones_pago (usuario_id, proveedor, referencia_externa, monto, moneda, estado)
         VALUES (?, 'PayPhone', ?, ?, 'USD', 'Rechazada')`,
        [req.usuario.id, clientTxId, (datos.amount || 0) / 100]
      );
      return res.status(400).json({ error: 'El pago no fue aprobado', detalle: datos });
    }

    await pool.query(
      `INSERT INTO transacciones_pago (usuario_id, proveedor, referencia_externa, monto, moneda, estado)
       VALUES (?, 'PayPhone', ?, ?, 'USD', 'Aprobada')`,
      [req.usuario.id, clientTxId, (datos.amount || 0) / 100]
    );

    const { fechaFin } = await activarPremium({ usuarioId: req.usuario.id, proveedor: 'PayPhone' });

    res.json({ mensaje: 'Pago aprobado, suscripción Premium activada', premiumHasta: fechaFin });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al confirmar el pago con PayPhone' });
  }
});

// ============================================================
// PAYPAL (Sandbox)
// ============================================================

// ----------------------------------------
// POST /api/pagos/paypal/crear-orden
// ----------------------------------------
router.post('/paypal/crear-orden', verificarToken, async (req, res) => {
  try {
    const montoUsd = Number(req.body.monto || PLAN_PREMIUM_MONTO).toFixed(2);
    const accessToken = await obtenerAccessTokenPaypal();
    const baseUrl = obtenerBaseUrlPaypal();

    const respuesta = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            description: 'Suscripción Premium SmartPlant',
            amount: { currency_code: 'USD', value: montoUsd }
          }
        ]
      })
    });

    const orden = await respuesta.json();
    if (!respuesta.ok) {
      return res.status(400).json({ error: 'No se pudo crear la orden en PayPal', detalle: orden });
    }

    res.json({ id: orden.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la orden de PayPal' });
  }
});

// ----------------------------------------
// POST /api/pagos/paypal/capturar-orden
// Body: { orderID }
// ----------------------------------------
router.post('/paypal/capturar-orden', verificarToken, async (req, res) => {
  const { orderID } = req.body;
  if (!orderID) return res.status(400).json({ error: 'orderID es obligatorio' });

  try {
    const accessToken = await obtenerAccessTokenPaypal();
    const baseUrl = obtenerBaseUrlPaypal();

    const respuesta = await fetch(`${baseUrl}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const captura = await respuesta.json();
    const montoCapturado = captura?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || PLAN_PREMIUM_MONTO;

    if (!respuesta.ok || captura.status !== 'COMPLETED') {
      await pool.query(
        `INSERT INTO transacciones_pago (usuario_id, proveedor, referencia_externa, monto, moneda, estado)
         VALUES (?, 'PayPal', ?, ?, 'USD', 'Rechazada')`,
        [req.usuario.id, orderID, montoCapturado]
      );
      return res.status(400).json({ error: 'El pago no fue completado', detalle: captura });
    }

    await pool.query(
      `INSERT INTO transacciones_pago (usuario_id, proveedor, referencia_externa, monto, moneda, estado)
       VALUES (?, 'PayPal', ?, ?, 'USD', 'Aprobada')`,
      [req.usuario.id, orderID, montoCapturado]
    );

    const { fechaFin } = await activarPremium({ usuarioId: req.usuario.id, proveedor: 'PayPal' });

    res.json({ mensaje: 'Pago aprobado, suscripción Premium activada', premiumHasta: fechaFin });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al capturar el pago de PayPal' });
  }
});

module.exports = router;
