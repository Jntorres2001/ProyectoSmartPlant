/**
 * Heurísticas deterministas sobre el historial de humedad.
 *
 * Importante: un modelo local de 0.5B (qwen2.5:0.5b) no es confiable haciendo
 * cálculos numéricos (promedios, tasas, proyecciones) de forma consistente.
 * Por eso estos valores (tendencia, salud estimada, próximo riego, riesgo)
 * se calculan aquí en código plano con los datos reales, y luego se le pasan
 * a Ollama como HECHOS ya calculados para que solo redacte la interpretación
 * en lenguaje natural — nunca le pedimos que "calcule", solo que "explique".
 *
 * `lecturas` siempre debe venir ordenado ASCENDENTE por fecha (la más
 * antigua primero, la más reciente al final).
 */

function calcularTendencia(lecturas = []) {
  if (lecturas.length < 2) return { tendencia: 'Estable', delta: 0 };

  const primero = Number(lecturas[0].humedad);
  const ultimo = Number(lecturas[lecturas.length - 1].humedad);
  const delta = Number((ultimo - primero).toFixed(1));

  let tendencia = 'Estable';
  if (delta <= -3) tendencia = 'Disminuyendo';
  else if (delta >= 3) tendencia = 'Aumentando';

  return { tendencia, delta };
}

// Salud estimada 0-100: heurística simple basada en qué tan lejos está la
// humedad actual del umbral mínimo configurado para ese dispositivo.
function calcularSaludEstimada(humedadActual, umbralMinimo) {
  if (humedadActual == null || Number.isNaN(Number(humedadActual))) return null;

  const humedad = Number(humedadActual);
  const umbral = umbralMinimo != null ? Number(umbralMinimo) : 35;
  const zonaIdeal = umbral + 25; // a partir de aquí consideramos "salud máxima"

  let salud;
  if (humedad >= zonaIdeal) {
    salud = 100;
  } else if (humedad >= umbral) {
    salud = 60 + ((humedad - umbral) / (zonaIdeal - umbral)) * 40;
  } else {
    salud = Math.max(0, (humedad / umbral) * 60);
  }

  return Math.round(salud);
}

// Estima en cuántas horas la humedad llegaría al umbral mínimo, extrapolando
// linealmente la tasa de cambio entre las dos últimas lecturas. Devuelve
// null si la humedad no está bajando o si no hay suficientes datos.
function estimarProximoRiegoHoras(lecturas = [], umbralMinimo) {
  if (lecturas.length < 2) return null;

  const anterior = lecturas[lecturas.length - 2];
  const actual = lecturas[lecturas.length - 1];

  const horasTranscurridas = (new Date(actual.creado_en) - new Date(anterior.creado_en)) / 3600000;
  const deltaHumedad = Number(actual.humedad) - Number(anterior.humedad);

  if (horasTranscurridas <= 0 || deltaHumedad >= 0) return null; // no está bajando

  const tasaPorHora = deltaHumedad / horasTranscurridas; // negativo
  const umbral = umbralMinimo != null ? Number(umbralMinimo) : 35;
  const horasHastaUmbral = (umbral - Number(actual.humedad)) / tasaPorHora;

  if (!Number.isFinite(horasHastaUmbral) || horasHastaUmbral <= 0) return null;

  return Math.round(horasHastaUmbral);
}

function hayRiesgoDeshidratacion(humedadActual, umbralMinimo, tendencia) {
  if (humedadActual == null) return false;
  const humedad = Number(humedadActual);
  const umbral = umbralMinimo != null ? Number(umbralMinimo) : 35;
  return humedad < umbral || (humedad < umbral + 8 && tendencia === 'Disminuyendo');
}

module.exports = {
  calcularTendencia,
  calcularSaludEstimada,
  estimarProximoRiegoHoras,
  hayRiesgoDeshidratacion
};
