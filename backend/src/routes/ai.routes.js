const express = require('express');
const { pool } = require('../config/db');
const { verificarToken } = require('../middleware/auth');
const { verificarPremium } = require('../middleware/premium');
const { chatConOllama } = require('../services/ollama.service');
const {
  contextoBaseSmartPlant,
  esUsuarioPremium,
  esConsultaSobreSmartPlant,
  MENSAJE_FUERA_DE_TEMA,
  obtenerDispositivoActivo,
  generarDiagnosticoCompleto
} = require('../services/asistenteIA.service');
const {
  calcularTendencia,
  calcularSaludEstimada,
  estimarProximoRiegoHoras,
  hayRiesgoDeshidratacion
} = require('../services/analisisHumedad.service');

const router = express.Router();

const MAX_MENSAJES_HISTORIAL = 12; // evita mandar contextos gigantes a un modelo de 0.5B

async function obtenerContextoDispositivoParaChat(usuarioId, dispositivoId) {
  const dispositivo = await obtenerDispositivoActivo(usuarioId, dispositivoId);
  if (!dispositivo) return null;

  const [lecturas] = await pool.query(
    `SELECT humedad, estado_planta, creado_en FROM lecturas WHERE dispositivo_id = ? ORDER BY creado_en DESC LIMIT 1`,
    [dispositivo.id]
  );
  const ultima = lecturas[0] || null;

  return {
    nombre_dispositivo: dispositivo.nombre_dispositivo,
    humedad_minima_alerta: dispositivo.humedad_minima_alerta,
    humedad: ultima?.humedad ?? null,
    estado_planta: ultima?.estado_planta ?? null,
    creado_en: ultima?.creado_en ?? null
  };
}

function construirPromptSistemaChat(contextoDispositivo) {
  let base = contextoBaseSmartPlant();

  if (contextoDispositivo) {
    base += `\n\nDatos actuales del dispositivo del usuario (usa estos datos reales si preguntan por su planta):
- Dispositivo: ${contextoDispositivo.nombre_dispositivo}
- Humedad actual: ${contextoDispositivo.humedad != null ? `${contextoDispositivo.humedad}%` : 'sin datos'}
- Estado de la planta: ${contextoDispositivo.estado_planta || 'sin datos'}
- Última lectura: ${contextoDispositivo.creado_en ? new Date(contextoDispositivo.creado_en).toLocaleString('es-ES') : 'sin datos'}
- Umbral mínimo de humedad configurado: ${contextoDispositivo.humedad_minima_alerta != null ? `${contextoDispositivo.humedad_minima_alerta}%` : 'sin datos'}`;
  } else {
    base += `\n\nEl usuario todavía no tiene un dispositivo con lecturas registradas.`;
  }

  return base;
}

// ----------------------------------------
// POST /api/ai/chat
// Body: { mensaje, historial?: [{ rol: 'usuario'|'ia', contenido }], dispositivo_id? }
// Protegido por token + suscripción Premium activa.
// ----------------------------------------
router.post('/chat', verificarToken, verificarPremium, async (req, res) => {
  const { mensaje, historial = [], dispositivo_id } = req.body;

  if (!mensaje || !mensaje.trim()) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
  }

  // Validación previa: si el mensaje no tiene relación con SmartPlant, se
  // rechaza aquí mismo, sin gastar una llamada a Ollama.
  if (!esConsultaSobreSmartPlant(mensaje)) {
    return res.json({ respuesta: MENSAJE_FUERA_DE_TEMA });
  }

  try {
    const contextoDispositivo = await obtenerContextoDispositivoParaChat(req.usuario.id, dispositivo_id);

    const historialRecortado = historial.slice(-MAX_MENSAJES_HISTORIAL).map((m) => ({
      role: m.rol === 'ia' ? 'assistant' : 'user',
      content: m.contenido
    }));

    const mensajes = [
      { role: 'system', content: construirPromptSistemaChat(contextoDispositivo) },
      ...historialRecortado,
      { role: 'user', content: mensaje }
    ];

    const respuesta = await chatConOllama(mensajes);

    res.json({ respuesta });
  } catch (error) {
    console.error('❌ Error en el chat de IA:', error.message);
    res.status(502).json({ error: error.message || 'Error al contactar al asistente de IA' });
  }
});

// ----------------------------------------
// POST /api/ai/diagnostico  ("Analizar mi planta")
// Body: { dispositivo_id? }
// Analiza hasta las últimas 50 lecturas reales (o las que existan) +
// genera un diagnóstico con Ollama. Guarda el resultado en diagnosticos_ia.
// Protegido por token + suscripción Premium activa.
// ----------------------------------------
router.post('/diagnostico', verificarToken, verificarPremium, async (req, res) => {
  try {
    const resultado = await generarDiagnosticoCompleto({
      usuarioId: req.usuario.id,
      dispositivoId: req.body.dispositivo_id
    });
    res.json(resultado);
  } catch (error) {
    console.error('❌ Error generando diagnóstico IA:', error.message);
    res.status(502).json({ error: error.message || 'Error al generar el diagnóstico' });
  }
});

// ----------------------------------------
// GET /api/ai/diagnosticos
// Historial de diagnósticos (manuales y automáticos) del usuario.
// Protegido por token + suscripción Premium activa.
// ----------------------------------------
router.get('/diagnosticos', verificarToken, verificarPremium, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT di.id, di.tipo, di.diagnostico, di.recomendaciones, di.tendencia, di.humedad_actual, di.creado_en,
              d.nombre_dispositivo
       FROM diagnosticos_ia di
       INNER JOIN dispositivos d ON d.id = di.dispositivo_id
       WHERE di.usuario_id = ?
       ORDER BY di.creado_en DESC
       LIMIT 30`,
      [req.usuario.id]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el historial de diagnósticos' });
  }
});

// ----------------------------------------
// GET /api/ai/estado-inteligente
// Alimenta la tarjeta "Estado Inteligente" del Panel Principal.
// NO usa verificarPremium: los usuarios FREE deben recibir una vista previa
// (no un error 403), y los usuarios Premium reciben el estado real.
// ----------------------------------------
router.get('/estado-inteligente', verificarToken, async (req, res) => {
  try {
    const premium = await esUsuarioPremium(req.usuario.id);

    if (!premium) {
      return res.json({
        premium: false,
        vistaPrevia: {
          humedad: 42,
          estadoGeneral: 'Saludable',
          saludEstimada: 82,
          proximoRiegoHoras: 18,
          recomendacion: 'Ejemplo: tu planta está en buen estado, no necesita riego inmediato.'
        }
      });
    }

    const dispositivo = await obtenerDispositivoActivo(req.usuario.id, req.query.dispositivo_id);
    if (!dispositivo) {
      return res.json({ premium: true, sinDatos: true });
    }

    const [lecturas] = await pool.query(
      `SELECT humedad, creado_en FROM lecturas WHERE dispositivo_id = ? ORDER BY creado_en DESC LIMIT 10`,
      [dispositivo.id]
    );

    if (lecturas.length === 0) {
      return res.json({ premium: true, sinDatos: true });
    }

    const lecturasAsc = lecturas.reverse();
    const humedadActual = Number(lecturasAsc[lecturasAsc.length - 1].humedad);
    const { tendencia } = calcularTendencia(lecturasAsc);
    const saludEstimada = calcularSaludEstimada(humedadActual, dispositivo.humedad_minima_alerta);
    const proximoRiegoHoras = estimarProximoRiegoHoras(lecturasAsc, dispositivo.humedad_minima_alerta);
    const riesgoDeshidratacion = hayRiesgoDeshidratacion(humedadActual, dispositivo.humedad_minima_alerta, tendencia);

    // Última recomendación generada automáticamente (si ya existe alguna)
    const [ultimasRecomendaciones] = await pool.query(
      `SELECT diagnostico AS recomendacion, tendencia, creado_en
       FROM diagnosticos_ia
       WHERE dispositivo_id = ? AND tipo = 'automatica'
       ORDER BY creado_en DESC
       LIMIT 5`,
      [dispositivo.id]
    );

    res.json({
      premium: true,
      dispositivoId: dispositivo.id,
      dispositivo: dispositivo.nombre_dispositivo,
      humedad: humedadActual,
      tendencia,
      saludEstimada,
      proximoRiegoHoras,
      riesgoDeshidratacion,
      recomendacion: ultimasRecomendaciones[0]?.recomendacion || 'Aún no hay una recomendación generada. Se creará automáticamente con la próxima lectura del ESP32.',
      recomendacionesRecientes: ultimasRecomendaciones
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el estado inteligente' });
  }
});

module.exports = router;
