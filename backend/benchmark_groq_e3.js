// benchmark_groq_e3.js
// Ejecutar con: node benchmark_groq_e3.js
// Reintenta SOLO el escenario E3 (50 lecturas) con pausa más larga,
// porque el límite de Groq es por tokens/minuto y los prompts de E3 son grandes.

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = "llama-3.1-8b-instant";

const N_CLOUD = 15;
const ESPERA_MS = 19000; // 19s entre llamadas -> ~3 llamadas/min, bajo el límite de 6000 TPM

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

const escenario = { id: 'E3', nombre: 'Diagnóstico (50 lecturas)', prompt: construirPromptDiagnostico(50) };

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

(async () => {
  console.log('=== Benchmark SmartPlant: Groq E3 solamente (pausa larga) ===');
  console.log(`Fecha: ${new Date().toLocaleString('es-ES')}`);
  console.log(`N=${N_CLOUD}, pausa=${ESPERA_MS}ms\n`);

  const tiempos = [];
  let errores = 0;
  for (let i = 0; i < N_CLOUD; i++) {
    const inicio = Date.now();
    try {
      const respuesta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: CONTEXTO_SISTEMA },
            { role: 'user', content: escenario.prompt }
          ]
        })
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(JSON.stringify(datos).slice(0, 200));
      const duracion = Date.now() - inicio;
      tiempos.push(duracion);
      process.stdout.write(`  [Groq E3] ${i + 1}/${N_CLOUD}: ${duracion} ms\n`);
    } catch (error) {
      errores++;
      process.stdout.write(`  [Groq E3] ${i + 1}/${N_CLOUD}: ERROR (${error.message})\n`);
    }
    if (i < N_CLOUD - 1) await sleep(ESPERA_MS);
  }

  console.log('\n=== RESUMEN E3 (copia este bloque) ===\n');
  const s = stats(tiempos);
  if (s) {
    console.log(`[CLOUD E3] ${escenario.nombre}: n=${s.n} errores=${errores} promedio=${s.promedio.toFixed(0)}ms sd=${s.desviacion.toFixed(0)}ms mediana=${s.mediana.toFixed(0)}ms min=${s.min}ms max=${s.max}ms`);
    console.log(`  datos_crudos_ms = [${tiempos.join(', ')}]`);
  } else {
    console.log(`SIN DATOS (${errores} errores de ${N_CLOUD} intentos)`);
  }
})();