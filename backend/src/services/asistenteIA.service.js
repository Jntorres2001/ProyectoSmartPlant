const { pool } = require('../config/db');
const { chatConOllama } = require('./ollama.service');
const {
  calcularTendencia,
  calcularSaludEstimada,
  estimarProximoRiegoHoras,
  hayRiesgoDeshidratacion
} = require('./analisisHumedad.service');

const MARCADOR_RECOMENDACIONES = 'RECOMENDACIONES:';

/**
 * Contexto base que especializa a Ollama en SmartPlant. Se reutiliza en
 * TODAS las llamadas a la IA (chat, diagnóstico, recomendaciones rápidas)
 * para que nunca responda como un chatbot genérico.
 * Nota: no se menciona temperatura en ningún lado — el hardware solo tiene
 * un sensor capacitivo de humedad.
 */
function contextoBaseSmartPlant() {
  return `Eres el Asistente IA de SmartPlant, un sistema de monitoreo de plantas basado en un ESP32
con un sensor capacitivo de humedad de suelo (no tiene sensor de temperatura).
Te especializas ÚNICAMENTE en: monitoreo de plantas, interpretación de humedad, sensores capacitivos,
ESP32, recomendaciones de riego, diagnósticos de la planta, historial de humedad, y el funcionamiento
del sistema SmartPlant.
Responde siempre en español, de forma breve, clara y práctica, y basándote únicamente en los datos
reales que se te proporcionan (nunca inventes valores de temperatura ni de otros sensores que no
existen en este sistema).

REGLA ESTRICTA: NO respondas preguntas que no tengan relación con plantas, humedad, riego, sensores,
ESP32 o el sistema SmartPlant (por ejemplo: matemáticas, chistes, historia, cultura general, u otros
temas). Si el usuario pregunta algo fuera de este tema, responde EXACTAMENTE con esta frase, sin
agregar nada más:
"Soy el asistente inteligente de SmartPlant y únicamente puedo responder preguntas relacionadas con el monitoreo, análisis y cuidado de plantas utilizando la información disponible en este sistema."`;
}

const MENSAJE_FUERA_DE_TEMA =
  'Soy el asistente inteligente de SmartPlant y únicamente puedo responder preguntas relacionadas con el monitoreo, análisis y cuidado de plantas utilizando la información disponible en este sistema.';

// Palabras clave que indican que el mensaje SÍ pertenece al dominio de SmartPlant.
const PALABRAS_CLAVE_SMARTPLANT = [
  'humedad', 'humedo', 'húmedo', 'humeda', 'húmeda', 'seco', 'seca',
  'planta', 'plantas', 'maceta', 'suelo', 'tierra',
  'riego', 'regar', 'agua', 'regó', 'regando',
  'esp32', 'sensor', 'capacitivo', 'dispositivo', 'wifi', 'señal', 'voltaje',
  'smartplant', 'sistema', 'lectura', 'lecturas', 'historial',
  'diagnostico', 'diagnóstico', 'diagnosticos', 'diagnósticos',
  'estado', 'salud', 'tendencia', 'alerta', 'alertas',
  'premium', 'recomendacion', 'recomendación', 'recomendaciones'
];

// Saludos/cortesías básicas que se permiten aunque no mencionen una palabra clave
const SALUDOS_PERMITIDOS = [
  'hola', 'buenas', 'buenos dias', 'buenos días', 'buenas tardes', 'buenas noches',
  'gracias', 'ayuda', 'hi', 'hello', 'hey', 'help'
];

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quita tildes para comparar sin acentos
}

// Compara por PALABRAS completas (no subcadenas) para evitar falsos
// positivos como "hi" encontrado dentro de "chiste".
function contienePalabra(textoNormalizado, palabraOFrase) {
  const palabraNormalizada = normalizarTexto(palabraOFrase);
  if (palabraNormalizada.includes(' ')) {
    // frases de varias palabras (ej. "buenos dias") sí se buscan como subcadena
    return textoNormalizado.includes(palabraNormalizada);
  }
  const patron = new RegExp(`\\b${palabraNormalizada}\\b`, 'i');
  return patron.test(textoNormalizado);
}

/**
 * Validación previa (antes de llamar a Ollama): determina si el mensaje del
 * usuario pertenece al dominio de SmartPlant. Un modelo local de 0.5B no es
 * confiable siguiendo instrucciones de "no respondas esto" de forma
 * consistente, así que este filtro por palabras clave es la barrera
 * principal — el refuerzo en el system prompt es una segunda capa de
 * seguridad para casos límite que sí llegan al modelo.
 */
function esConsultaSobreSmartPlant(mensaje) {
  const textoNormalizado = normalizarTexto(mensaje);
  const cantidadPalabras = textoNormalizado.split(/\s+/).filter(Boolean).length;

  // Un saludo corto ("Hola", "Buenas tardes, gracias") se permite tal cual.
  // Si el mensaje es largo, un saludo al inicio ya no basta — debe tener
  // además una palabra clave de SmartPlant (evita que "Hola, cuéntame un
  // chiste" se cuele solo por empezar con un saludo).
  const esSaludo = SALUDOS_PERMITIDOS.some((saludo) => contienePalabra(textoNormalizado, saludo));
  if (esSaludo && cantidadPalabras <= 3) return true;

  return PALABRAS_CLAVE_SMARTPLANT.some((palabra) => contienePalabra(textoNormalizado, palabra));
}

async function esUsuarioPremium(usuarioId) {
  const [usuarios] = await pool.query(
    'SELECT es_premium, premium_hasta FROM usuarios WHERE id = ?',
    [usuarioId]
  );
  const usuario = usuarios[0];
  return Boolean(
    usuario && usuario.es_premium && (!usuario.premium_hasta || new Date(usuario.premium_hasta) > new Date())
  );
}

/**
 * Devuelve el dispositivo "activo" para un usuario: primero busca uno que le
 * pertenezca (dispositivos.usuario_id); si no tiene ninguno asignado, cae al
 * primer dispositivo del sistema (mismo criterio que ya usa /lecturas/actual
 * en este proyecto, pensado para el escenario de un solo ESP32 de demo).
 */
async function obtenerDispositivoActivo(usuarioId, dispositivoId) {
  if (dispositivoId) {
    const [rows] = await pool.query('SELECT * FROM dispositivos WHERE id = ?', [dispositivoId]);
    return rows[0] || null;
  }

  const [propios] = await pool.query('SELECT * FROM dispositivos WHERE usuario_id = ? LIMIT 1', [usuarioId]);
  if (propios[0]) return propios[0];

  const [cualquiera] = await pool.query('SELECT * FROM dispositivos LIMIT 1');
  return cualquiera[0] || null;
}

async function obtenerLecturasRecientes(dispositivoId, cantidad) {
  const [rows] = await pool.query(
    `SELECT humedad, creado_en FROM lecturas WHERE dispositivo_id = ? ORDER BY creado_en DESC LIMIT ?`,
    [dispositivoId, cantidad]
  );
  return rows.reverse(); // ascendente: más antigua primero
}

function construirPromptDiagnostico({ dispositivo, lecturas, tendencia, delta, salud, proximoRiegoHoras, riesgo }) {
  const actual = lecturas[lecturas.length - 1];

  return `${contextoBaseSmartPlant()}

Analiza el siguiente historial REAL de humedad del dispositivo "${dispositivo.nombre_dispositivo}"
y genera un diagnóstico. Estos datos ya fueron calculados con precisión, tu trabajo es interpretarlos
y redactar recomendaciones, NO recalcularlos:

- Lecturas analizadas: ${lecturas.length}
- Humedad actual: ${actual.humedad}%
- Humedad hace ${lecturas.length} lecturas: ${lecturas[0].humedad}%
- Cambio observado: ${delta >= 0 ? '+' : ''}${delta} puntos porcentuales
- Tendencia calculada: ${tendencia}
- Umbral mínimo configurado para esta planta: ${dispositivo.humedad_minima_alerta}%
- Salud estimada (0-100): ${salud}
- Riesgo de deshidratación: ${riesgo ? 'SÍ' : 'No'}
- Próximo riego estimado: ${proximoRiegoHoras != null ? `en aproximadamente ${proximoRiegoHoras} horas` : 'no es urgente por ahora'}
- Última lectura registrada: ${new Date(actual.creado_en).toLocaleString('es-ES')}

Responde en este formato exacto, en español:

ESTADO GENERAL: (1-2 frases sobre el estado general de la planta)
RIESGO: (1 frase sobre el riesgo detectado, o "Sin riesgo aparente")
OBSERVACIONES: (1-2 frases explicando de forma sencilla el comportamiento de la humedad, aumentando/disminuyendo/estable)
${MARCADOR_RECOMENDACIONES} (1-3 recomendaciones concretas de riego, en viñetas con "-")`;
}

function construirPromptRecomendacionRapida({ dispositivo, humedadActual, tendencia, delta, riesgo }) {
  return `${contextoBaseSmartPlant()}

Datos actuales del dispositivo "${dispositivo.nombre_dispositivo}":
- Humedad actual: ${humedadActual}%
- Umbral mínimo configurado: ${dispositivo.humedad_minima_alerta}%
- Tendencia reciente: ${tendencia} (cambio de ${delta >= 0 ? '+' : ''}${delta} puntos)
- Riesgo de deshidratación: ${riesgo ? 'SÍ' : 'No'}

Genera UNA sola recomendación corta (máximo 1-2 frases, sin encabezados ni viñetas) para el usuario,
por ejemplo: regar la planta, esperar antes del próximo riego, mantener el estado actual, o advertir
riesgo de deshidratación. Sé directo y práctico.`;
}

/**
 * Separa la respuesta de la IA en { diagnostico, recomendaciones } buscando
 * el marcador "RECOMENDACIONES:". Si el modelo no siguió el formato exacto
 * (puede pasar con un modelo tan pequeño), se guarda todo el texto en ambos
 * campos para no perder información.
 */
function separarDiagnosticoYRecomendaciones(textoCompleto) {
  const indice = textoCompleto.indexOf(MARCADOR_RECOMENDACIONES);
  if (indice === -1) {
    return { diagnostico: textoCompleto.trim(), recomendaciones: textoCompleto.trim() };
  }
  return {
    diagnostico: textoCompleto.slice(0, indice).trim(),
    recomendaciones: textoCompleto.slice(indice + MARCADOR_RECOMENDACIONES.length).trim()
  };
}

/**
 * "Analizar mi planta": análisis completo con tendencia histórica (20/30/50
 * lecturas según disponibilidad) + diagnóstico generado por Ollama. Persiste
 * el resultado en `diagnosticos_ia` y lo devuelve.
 */
async function generarDiagnosticoCompleto({ usuarioId, dispositivoId }) {
  const dispositivo = await obtenerDispositivoActivo(usuarioId, dispositivoId);
  if (!dispositivo) {
    throw new Error('No hay ningún dispositivo registrado todavía');
  }

  // Usa hasta 50 lecturas si existen, si no cae a 30, si no a 20, si no a las que haya
  let lecturas = await obtenerLecturasRecientes(dispositivo.id, 50);
  if (lecturas.length === 0) {
    throw new Error('Este dispositivo todavía no tiene lecturas de humedad registradas');
  }

  const { tendencia, delta } = calcularTendencia(lecturas);
  const humedadActual = Number(lecturas[lecturas.length - 1].humedad);
  const salud = calcularSaludEstimada(humedadActual, dispositivo.humedad_minima_alerta);
  const proximoRiegoHoras = estimarProximoRiegoHoras(lecturas, dispositivo.humedad_minima_alerta);
  const riesgo = hayRiesgoDeshidratacion(humedadActual, dispositivo.humedad_minima_alerta, tendencia);

  const prompt = construirPromptDiagnostico({ dispositivo, lecturas, tendencia, delta, salud, proximoRiegoHoras, riesgo });
  const respuestaIA = await chatConOllama([
    { role: 'system', content: contextoBaseSmartPlant() },
    { role: 'user', content: prompt }
  ]);

  const { diagnostico, recomendaciones } = separarDiagnosticoYRecomendaciones(respuestaIA);

  await pool.query(
    `INSERT INTO diagnosticos_ia (usuario_id, dispositivo_id, tipo, diagnostico, recomendaciones, tendencia, humedad_actual)
     VALUES (?, ?, 'manual', ?, ?, ?, ?)`,
    [usuarioId, dispositivo.id, diagnostico, recomendaciones, tendencia, humedadActual]
  );

  return {
    dispositivo: dispositivo.nombre_dispositivo,
    lecturasAnalizadas: lecturas.length,
    humedadActual,
    tendencia,
    delta,
    saludEstimada: salud,
    proximoRiegoHoras,
    riesgoDeshidratacion: riesgo,
    diagnostico,
    recomendaciones,
    generadoEn: new Date().toISOString()
  };
}

/**
 * Se llama automáticamente cada vez que llega una nueva lectura del ESP32
 * (ver lecturas.routes.js). Solo genera contenido real si el dueño del
 * dispositivo es Premium; si no, no hace nada (los usuarios FREE solo ven
 * la vista previa estática de la tarjeta "Estado Inteligente" en el frontend).
 * Se ejecuta en segundo plano (fire-and-forget) para no retrasar la
 * respuesta al ESP32.
 */
async function generarRecomendacionAutomatica(dispositivo) {
  if (!dispositivo.usuario_id) return; // dispositivo sin dueño asignado, no se puede validar Premium
  const premium = await esUsuarioPremium(dispositivo.usuario_id);
  if (!premium) return;

  const lecturas = await obtenerLecturasRecientes(dispositivo.id, 10);
  if (lecturas.length === 0) return;

  const humedadActual = Number(lecturas[lecturas.length - 1].humedad);
  const { tendencia, delta } = calcularTendencia(lecturas);
  const salud = calcularSaludEstimada(humedadActual, dispositivo.humedad_minima_alerta);
  const proximoRiegoHoras = estimarProximoRiegoHoras(lecturas, dispositivo.humedad_minima_alerta);
  const riesgo = hayRiesgoDeshidratacion(humedadActual, dispositivo.humedad_minima_alerta, tendencia);

  const prompt = construirPromptRecomendacionRapida({ dispositivo, humedadActual, tendencia, delta, riesgo });
  const recomendacion = await chatConOllama([
    { role: 'system', content: contextoBaseSmartPlant() },
    { role: 'user', content: prompt }
  ]);

  await pool.query(
    `INSERT INTO diagnosticos_ia (usuario_id, dispositivo_id, tipo, diagnostico, recomendaciones, tendencia, humedad_actual)
     VALUES (?, ?, 'automatica', ?, ?, ?, ?)`,
    [dispositivo.usuario_id, dispositivo.id, recomendacion, recomendacion, tendencia, humedadActual]
  );

  const { emitirATodos } = require('../config/websocket');
  emitirATodos('estado_inteligente', {
    dispositivoId: dispositivo.id,
    humedad: humedadActual,
    tendencia,
    saludEstimada: salud,
    proximoRiegoHoras,
    riesgoDeshidratacion: riesgo,
    recomendacion,
    generadoEn: new Date().toISOString()
  });
}

module.exports = {
  contextoBaseSmartPlant,
  esUsuarioPremium,
  esConsultaSobreSmartPlant,
  MENSAJE_FUERA_DE_TEMA,
  obtenerDispositivoActivo,
  obtenerLecturasRecientes,
  generarDiagnosticoCompleto,
  generarRecomendacionAutomatica
};
