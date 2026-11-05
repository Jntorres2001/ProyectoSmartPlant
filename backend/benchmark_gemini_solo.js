// benchmark_gemini_solo.js
// Ejecutar con: node benchmark_gemini_solo.js
// Solo mide Gemini (nube), ya tienes los datos de Ollama.

require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Error: configura GEMINI_API_KEY en backend/.env antes de ejecutar el benchmark.');
  process.exit(1);
}

const GEMINI_MODEL = "gemini-2.0-flash";

const N_CLOUD = 5; // reducido para ir más rápido; si funciona bien puedes subirlo
const ESPERA_MS = 4500;

const CONTEXTO_SISTEMA = `Eres el Asistente IA de SmartPlant, un sistema de monitoreo de plantas
basado en un ESP32 con un sensor capacitivo de humedad de suelo (no tiene sensor de temperatura).
Respondes siempre en español, de forma breve, clara y práctica.`;

function construirPromptDiagnostico(n) {
  let historico = '';
  let humedad = 60;
  for (let i = 0; i < n; i++) {
    humedad += (Math.random() * 4 - 2.5);
    historico += `Lectura ${i + 1}: ${humedad.toFixed(1)}%\n`;
  }
  return `Analiza el siguiente historial real de humedad del dispositivo "ESP32-Demo":

- Lecturas analizadas: ${n}
- Humedad actual: ${humedad.toFixed(1)}%
- Tendencia calculada: Disminuyendo
- Umbral mínimo configurado: 35%
- Salud estimada (0-100): 62
- Riesgo de deshidratación: No
- Próximo riego estimado: en aproximadamente 8 horas

Historial:
${historico}

Responde en este formato exacto, en español:
ESTADO GENERAL: (1-2 frases)
RIESGO: (1 frase)
OBSERVACIONES: (1-2 frases)
RECOMENDACIONES: (1-3 recomendaciones en viñetas con "-")`;
}

const escenarios = [
  { id: 'E1', nombre: 'Chat corto (sin historial)', prompt: '¿Cada cuánto debo regar mi planta?' },
  { id: 'E2', nombre: 'Diagnóstico (10 lecturas)', prompt: construirPromptDiagnostico(10) },
  { id: 'E3', nombre: 'Diagnóstico (50 lecturas)', prompt: construirPromptDiagnostico(50) }
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function stats(tiempos) {
  const n = tiempos.length;
  if (n === 0) return null;
  const promedio = tiempos.reduce((a, b) => a + b, 0) / n;
  const varianza = n > 1 ? tiempos.reduce((acc, t) => acc + (t - promedio) ** 2, 0) / (n - 1) : 0;
  const desviacion = Math.sqrt(varianza);
  const ordenados = [...tiempos].sort((a, b) => a - b);
  const mediana = n % 2 === 0 ? (ordenados[n/2 - 1] + ordenados[n/2]) / 2 : ordenados[(n-1)/2];
  return { n, promedio, desviacion, mediana, min: Math.min(...tiempos), max: Math.max(...tiempos) };
}

async function medirGemini(escenario) {
  const tiempos = [];
  let errores = 0;
  for (let i = 0; i < N_CLOUD; i++) {
    const inicio = Date.now();
    try {
      const respuesta = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${CONTEXTO_SISTEMA}\n\n${escenario.prompt}` }] }]
          })
        }
      );
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(JSON.stringify(datos).slice(0, 200));
      const duracion = Date.now() - inicio;
      tiempos.push(duracion);
      process.stdout.write(`  [Gemini ${escenario.id}] ${i + 1}/${N_CLOUD}: ${duracion} ms\n`);
    } catch (error) {
      errores++;
      process.stdout.write(`  [Gemini ${escenario.id}] ${i + 1}/${N_CLOUD}: ERROR (${error.message})\n`);
    }
    await sleep(ESPERA_MS);
  }
  return { tiempos, errores };
}

(async () => {
  console.log('=== Benchmark SmartPlant: Gemini (nube) solamente ===');
  console.log(`Fecha: ${new Date().toLocaleString('es-ES')}`);
  console.log(`N_CLOUD=${N_CLOUD} por escenario\n`);

  const resultados = {};
  for (const e of escenarios) {
    console.log(`--- Gemini (nube) - ${e.nombre} ---`);
    resultados[e.id] = await medirGemini(e);
    console.log('');
  }

  console.log('=== RESUMEN (copia TODO este bloque) ===\n');
  for (const e of escenarios) {
    const r = resultados[e.id];
    const s = stats(r.tiempos);
    if (s) {
      console.log(`[CLOUD ${e.id}] ${e.nombre}: n=${s.n} errores=${r.errores} promedio=${s.promedio.toFixed(0)}ms sd=${s.desviacion.toFixed(0)}ms mediana=${s.mediana.toFixed(0)}ms min=${s.min}ms max=${s.max}ms`);
      console.log(`  datos_crudos_ms = [${r.tiempos.join(', ')}]`);
    } else {
      console.log(`[CLOUD ${e.id}] ${e.nombre}: SIN DATOS (${r.errores} errores de ${N_CLOUD} intentos)`);
    }
  }
})();