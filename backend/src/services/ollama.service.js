require('dotenv').config();

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b';

/**
 * Envía una conversación al modelo local de Ollama y devuelve la respuesta
 * de texto completa (sin streaming, para mantener el endpoint simple).
 *
 * mensajes: [{ role: 'system' | 'user' | 'assistant', content: '...' }]
 */
async function chatConOllama(mensajes) {
  let respuesta;
  try {
    respuesta = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: mensajes,
        stream: false
      })
    });
  } catch (error) {
    // Ollama no está corriendo o no es alcanzable en OLLAMA_URL
    throw new Error(
      `No se pudo conectar con Ollama en ${OLLAMA_URL}. ¿Está corriendo? (ollama serve). Detalle: ${error.message}`
    );
  }

  if (!respuesta.ok) {
    const texto = await respuesta.text().catch(() => '');
    throw new Error(`Ollama respondió con error ${respuesta.status}: ${texto}`);
  }

  const datos = await respuesta.json();
  return datos?.message?.content?.trim() || '';
}

module.exports = { chatConOllama, OLLAMA_MODEL };
