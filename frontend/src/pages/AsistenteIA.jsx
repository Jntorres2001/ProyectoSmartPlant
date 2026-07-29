import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import BloqueoPremium from '../components/BloqueoPremium';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

function BurbujaMensaje({ rol, contenido }) {
  const esUsuario = rol === 'usuario';
  return (
    <div style={{ display: 'flex', justifyContent: esUsuario ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      <div
        style={{
          maxWidth: '75%',
          padding: '10px 14px',
          borderRadius: 14,
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          background: esUsuario ? '#3aa05a' : '#f0f8f2',
          color: esUsuario ? '#ffffff' : '#1f2d24',
          borderBottomRightRadius: esUsuario ? 4 : 14,
          borderBottomLeftRadius: esUsuario ? 14 : 4
        }}
      >
        {contenido}
      </div>
    </div>
  );
}

// Convierte el resultado de "Analizar mi planta" en un mensaje de chat legible
function formatearDiagnostico(d) {
  const riesgo = d.riesgoDeshidratacion ? '⚠️ Sí' : 'No detectado';
  const proximoRiego = d.proximoRiegoHoras != null ? `en ~${d.proximoRiegoHoras}h` : 'no urgente';
  return `📋 Diagnóstico de "${d.dispositivo}" (${d.lecturasAnalizadas} lecturas analizadas)

💧 Humedad actual: ${d.humedadActual}%
📈 Tendencia: ${d.tendencia} (${d.delta >= 0 ? '+' : ''}${d.delta} pts)
❤️ Salud estimada: ${d.saludEstimada}/100
⏳ Próximo riego: ${proximoRiego}
⚠️ Riesgo de deshidratación: ${riesgo}

${d.diagnostico}

🤖 Recomendaciones:
${d.recomendaciones}`;
}

export default function AsistenteIA() {
  const { usuario } = useAuth();
  const [mensajes, setMensajes] = useState([
    { rol: 'ia', contenido: '¡Hola! 🌱 Soy el asistente de SmartPlant. Pregúntame sobre el riego, la humedad o cómo funciona tu ESP32, o presiona "Analizar mi planta" para un diagnóstico completo.' }
  ]);
  const [entrada, setEntrada] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState('');
  const finConversacionRef = useRef(null);

  useEffect(() => {
    finConversacionRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, escribiendo, analizando]);

  if (!usuario?.esPremium) {
    return (
      <BloqueoPremium
        titulo="Asistente IA"
        descripcion="El Asistente IA de SmartPlant (chat, diagnóstico y análisis de tendencias sobre tu planta) está disponible únicamente para cuentas Premium."
      />
    );
  }

  async function enviarMensaje(evento) {
    evento.preventDefault();
    const texto = entrada.trim();
    if (!texto || escribiendo) return;

    const nuevosMensajes = [...mensajes, { rol: 'usuario', contenido: texto }];
    setMensajes(nuevosMensajes);
    setEntrada('');
    setError('');
    setEscribiendo(true);

    try {
      const historialParaBackend = nuevosMensajes.filter((m) => m.rol !== 'sistema');
      const { respuesta } = await api.chatIA(texto, historialParaBackend);
      setMensajes((prev) => [...prev, { rol: 'ia', contenido: respuesta || '(sin respuesta)' }]);
    } catch (err) {
      setError(err.message || 'No se pudo contactar al asistente de IA');
    } finally {
      setEscribiendo(false);
    }
  }

  async function analizarPlanta() {
    if (analizando) return;
    setAnalizando(true);
    setError('');
    setMensajes((prev) => [...prev, { rol: 'usuario', contenido: '🔍 Analizar mi planta' }]);

    try {
      const diagnostico = await api.analizarPlanta();
      setMensajes((prev) => [...prev, { rol: 'ia', contenido: formatearDiagnostico(diagnostico) }]);
    } catch (err) {
      setError(err.message || 'No se pudo generar el diagnóstico');
    } finally {
      setAnalizando(false);
    }
  }

  return (
    <Layout titulo="Asistente IA">
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '75vh', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef2ef', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Asistente SmartPlant</div>
              <div style={{ fontSize: 12, color: '#6b7d72' }}>Modelo local · Ollama (qwen2.5:0.5b)</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="boton-primario"
              style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}
              onClick={analizarPlanta}
              disabled={analizando}
            >
              {analizando ? 'Analizando...' : '🔍 Analizar mi planta'}
            </button>
            <Link to="/diagnosticos-ia" style={{ fontSize: 12, color: '#3aa05a', fontWeight: 600, textDecoration: 'none' }}>
              Ver historial →
            </Link>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {mensajes.map((m, i) => (
            <BurbujaMensaje key={i} rol={m.rol} contenido={m.contenido} />
          ))}

          {(escribiendo || analizando) && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
              <div style={{ padding: '10px 14px', borderRadius: 14, background: '#f0f8f2', color: '#6b7d72', fontSize: 13, fontStyle: 'italic' }}>
                {analizando ? 'Analizando el historial de tu planta...' : 'La IA está escribiendo...'}
              </div>
            </div>
          )}

          {error && (
            <p style={{ color: '#d64545', fontSize: 13, textAlign: 'center' }}>{error}</p>
          )}

          <div ref={finConversacionRef} />
        </div>

        <form onSubmit={enviarMensaje} style={{ display: 'flex', gap: 10, padding: 16, borderTop: '1px solid #eef2ef' }}>
          <input
            type="text"
            className="login-input"
            style={{ margin: 0, flex: 1 }}
            placeholder="Escribe tu pregunta sobre tu planta..."
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            disabled={escribiendo}
          />
          <button type="submit" className="boton-primario" style={{ width: 'auto', padding: '0 22px' }} disabled={escribiendo || !entrada.trim()}>
            Enviar
          </button>
        </form>
      </div>
    </Layout>
  );
}
