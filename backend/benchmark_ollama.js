// benchmark_v2.js
// Ejecutar con: node benchmark_v2.js
// Requiere Node.js 18+ (fetch nativo), Ollama corriendo con qwen2.5:0.5b,
// y una API key gratuita de Google AI Studio (https://aistudio.google.com/apikey)

// ============ CONFIGURA ESTO ============
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""; // https://aistudio.google.com/apikey
const GEMINI_MODEL = "gemini-2.0-flash";
// =========================================

const OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'qwen2.5:0.5b';

const N_LOCAL = 30;  // repeticiones para Ollama (local)
const N_CLOUD = 15;  // repeticiones para Gemini (nube) - menor por límites de la capa gratuita
const ESPERA_ENTRE_LLAMADAS_CLOUD_MS = 4500; // evita exceder el límite de solicitudes/minuto gratuito

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
  const promedio = tiempos.reduce((a, b) => a + b, 0) / n;
  const varianza = tiempos.reduce((acc, t) => acc + (t - promedio) ** 2, 0) / (n - 1);
  const desviacion = Math.sqrt(varianza);
  const ordenados = [...tiempos].sort((a, b) => a - b);
  const mediana = n % 2 === 0 ? (ordenados[n/2 - 1] + ordenados[n/2]) / 2 : ordenados[(n-1)/2];
  return { n, promedio, desviacion, mediana, min: Math.min(...tiempos), max: Math.max(...tiempos) };
}

async function medirOllama(escenario) {
  const tiempos = [];
  for (let i = 0; i < N_LOCAL; i++) {
    const inicio = Date.now();
    const respuesta = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: 'system', content: CONTEXTO_SISTEMA }, { role: 'user', content: escenario.prompt }],
        stream: false
      })
    });
    await respuesta.json();
    tiempos.push(Date.now() - inicio);
    process.stdout.write(`  [Ollama ${escenario.id}] ${i + 1}/${N_LOCAL}: ${tiempos[tiempos.length - 1]} ms\n`);
  }
  return tiempos;
}

async function medirGemini(escenario) {
  const tiempos = [];
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
      process.stdout.write(`  [Gemini ${escenario.id}] ${i + 1}/${N_CLOUD}: ERROR (${error.message})\n`);
    }
    await sleep(ESPERA_ENTRE_LLAMADAS_CLOUD_MS);
  }
  return tiempos;
}

(async () => {
  console.log('=== Benchmark SmartPlant: Ollama local vs Gemini (nube) ===');
  console.log(`Fecha: ${new Date().toLocaleString('es-ES')}`);
  console.log(`N_LOCAL=${N_LOCAL} por escenario | N_CLOUD=${N_CLOUD} por escenario\n`);

  const resultadosLocal = {};
  const resultadosCloud = {};

  for (const e of escenarios) {
    console.log(`--- Ollama (local) - ${e.nombre} ---`);
    resultadosLocal[e.id] = await medirOllama(e);
    console.log('');
  }

  if (GEMINI_API_KEY === 'CLAVE_ELIMINADA') {
    console.log('⚠️  No configuraste GEMINI_API_KEY, se omite la parte de la nube.');
  } else {
    for (const e of escenarios) {
      console.log(`--- Gemini (nube) - ${e.nombre} ---`);
      resultadosCloud[e.id] = await medirGemini(e);
      console.log('');
    }
  }

  console.log('=== RESUMEN (copia TODO este bloque, incluidos los datos crudos) ===\n');
  for (const e of escenarios) {
    const s = stats(resultadosLocal[e.id]);
    console.log(`[LOCAL ${e.id}] ${e.nombre}: n=${s.n} promedio=${s.promedio.toFixed(0)}ms sd=${s.desviacion.toFixed(0)}ms mediana=${s.mediana.toFixed(0)}ms min=${s.min}ms max=${s.max}ms`);
    console.log(`  datos_crudos_ms = [${resultadosLocal[e.id].join(', ')}]`);
  }
  console.log('');
  for (const e of escenarios) {
    if (!resultadosCloud[e.id] || resultadosCloud[e.id].length === 0) continue;
    const s = stats(resultadosCloud[e.id]);
    console.log(`[CLOUD ${e.id}] ${e.nombre}: n=${s.n} promedio=${s.promedio.toFixed(0)}ms sd=${s.desviacion.toFixed(0)}ms mediana=${s.mediana.toFixed(0)}ms min=${s.min}ms max=${s.max}ms`);
    console.log(`  datos_crudos_ms = [${resultadosCloud[e.id].join(', ')}]`);
  }
})();