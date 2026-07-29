import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import Layout from '../components/Layout';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

function estadoAPill(estado) {
  if (estado === 'Critico') return { clase: 'critico', texto: '⚠ Crítico' };
  if (estado === 'Necesita agua') return { clase: 'necesita-agua', texto: '💧 Necesita agua' };
  return { clase: 'saludable', texto: '🌿 Saludable' };
}

function tendenciaATexto(tendencia) {
  if (tendencia === 'Disminuyendo') return { icono: '📉', texto: 'Disminuyendo', color: '#d64545' };
  if (tendencia === 'Aumentando') return { icono: '📈', texto: 'Aumentando', color: '#2f8a4c' };
  return { icono: '➖', texto: 'Estable', color: '#9aa79f' };
}

// ---------- Tarjeta "Estado Inteligente" (IA), con vista previa para usuarios FREE ----------
function TarjetaEstadoInteligente() {
  const { usuario } = useAuth();
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    api
      .obtenerEstadoInteligente()
      .then(setEstado)
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  // Se vuelve a consultar el estado cada vez que cambia el estado Premium
  // global del usuario (ej. justo después de confirmar un pago), usando el
  // mismo AuthContext que ya usa el resto del sistema — así la tarjeta no
  // depende de recargar la página ni de cerrar sesión.
  useEffect(() => {
    cargar();
  }, [cargar, usuario?.esPremium]);

  // Actualización en tiempo real cuando el Worker de IA genera una nueva recomendación
  useWebSocket((mensaje) => {
    if (mensaje.tipo === 'estado_inteligente' && usuario?.esPremium) {
      setEstado((prev) => ({ ...prev, premium: true, ...mensaje.datos }));
    }
  });

  if (cargando) {
    return (
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>🌱 Estado Inteligente</h3>
        <p style={{ color: '#6b7d72', fontSize: 13 }}>Cargando...</p>
      </div>
    );
  }

  // ---- Vista previa para usuarios FREE ----
  if (!estado?.premium) {
    const v = estado?.vistaPrevia || {};
    return (
      <div className="panel" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ marginTop: 0 }}>🌱 Estado Inteligente</h3>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9aa79f', background: '#f3f6f4', padding: '3px 8px', borderRadius: 8 }}>
            🔒 Vista previa
          </span>
        </div>
        <div style={{ opacity: 0.55, pointerEvents: 'none' }}>
          <p style={{ fontSize: 13, color: '#6b7d72' }}>💧 Humedad actual: {v.humedad}%</p>
          <p style={{ fontSize: 13, color: '#6b7d72' }}>🟢 Estado general: {v.estadoGeneral}</p>
          <p style={{ fontSize: 13, color: '#6b7d72' }}>❤️ Salud estimada: {v.saludEstimada}/100</p>
          <p style={{ fontSize: 13, color: '#6b7d72' }}>⏳ Próximo riego: en ~{v.proximoRiegoHoras}h</p>
          <p style={{ fontSize: 13, color: '#6b7d72' }}>🤖 {v.recomendacion}</p>
        </div>
        <Link to="/configuracion" className="boton-primario" style={{ display: 'inline-block', width: 'auto', marginTop: 10, padding: '10px 20px', textDecoration: 'none' }}>
          🌟 Actualizar a Premium
        </Link>
      </div>
    );
  }

  // ---- Sin lecturas todavía ----
  if (estado.sinDatos) {
    return (
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>🌱 Estado Inteligente</h3>
        <p style={{ color: '#6b7d72', fontSize: 13 }}>Aún no hay lecturas para analizar.</p>
      </div>
    );
  }

  // ---- Usuario Premium: estado real ----
  const pill = estadoAPill(
    estado.riesgoDeshidratacion ? 'Necesita agua' : 'Saludable'
  );
  const t = tendenciaATexto(estado.tendencia);

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>🌱 Estado Inteligente</h3>
        <span className="etiqueta-tiempo-real">IA · Tiempo real</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
        <div>💧 Humedad actual: <strong>{Number(estado.humedad).toFixed(0)}%</strong></div>
        <div>🟢 Estado general: <span className={`pill ${pill.clase}`} style={{ marginLeft: 4 }}>{pill.texto}</span></div>
        <div>❤️ Salud estimada: <strong>{estado.saludEstimada}/100</strong></div>
        <div>⏳ Próximo riego: <strong>{estado.proximoRiegoHoras != null ? `~${estado.proximoRiegoHoras}h` : 'no urgente'}</strong></div>
        <div style={{ gridColumn: '1 / -1' }}>
          {t.icono} Tendencia: <span style={{ color: t.color, fontWeight: 600 }}>{t.texto}</span>
        </div>
      </div>
      <div style={{ background: '#f0f8f2', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#2f6b40', marginTop: 12 }}>
        🤖 {estado.recomendacion}
      </div>
    </div>
  );
}

// ---------- Sección "Recomendaciones de la IA" ----------
function SeccionRecomendacionesIA({ recomendaciones }) {
  if (!recomendaciones || recomendaciones.length === 0) return null;
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>🤖 Recomendaciones de la IA</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recomendaciones.map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: i < recomendaciones.length - 1 ? '1px solid #f3f6f4' : 'none' }}>
            <span style={{ fontSize: 13, color: '#1f2d24' }}>{r.recomendacion}</span>
            <span style={{ fontSize: 11, color: '#9aa79f', whiteSpace: 'nowrap' }}>
              {new Date(r.creado_en).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [lectura, setLectura] = useState(null);
  const [historialGrafico, setHistorialGrafico] = useState([]);
  const [recomendacionesIA, setRecomendacionesIA] = useState([]);
  const [error, setError] = useState('');

  const cargarDatos = useCallback(async () => {
    try {
      const [actuales] = await api.obtenerLecturaActual();
      setLectura(actuales || null);

      const { datos } = await api.obtenerHistorial({ limite: 10 });
      setHistorialGrafico(
        [...datos].reverse().map((d) => ({
          hora: new Date(d.creado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          humedad: Number(d.humedad)
        }))
      );
    } catch (err) {
      setError('No se pudo conectar con el backend. ¿Está corriendo en localhost:3000?');
    }

    try {
      const estadoIA = await api.obtenerEstadoInteligente();
      if (estadoIA.premium && estadoIA.recomendacionesRecientes) {
        setRecomendacionesIA(estadoIA.recomendacionesRecientes);
      }
    } catch (_) {
      /* la tarjeta Estado Inteligente ya maneja su propio estado de carga/errores */
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Tiempo real: cuando llega una nueva lectura por WebSocket, actualiza todo sin recargar
  const { conectado } = useWebSocket((mensaje) => {
    if (mensaje.tipo === 'nueva_lectura') {
      setLectura(mensaje.datos);
      setHistorialGrafico((prev) => [
        ...prev.slice(-9),
        {
          hora: new Date(mensaje.datos.creado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          humedad: Number(mensaje.datos.humedad)
        }
      ]);
    }
    if (mensaje.tipo === 'estado_inteligente') {
      setRecomendacionesIA((prev) => [
        { recomendacion: mensaje.datos.recomendacion, tendencia: mensaje.datos.tendencia, creado_en: mensaje.datos.generadoEn },
        ...prev
      ].slice(0, 5));
    }
  });

  const pill = estadoAPill(lectura?.estadoPlanta || lectura?.estado_planta);

  return (
    <Layout titulo="Panel Principal">
      {error && (
        <div className="panel" style={{ marginBottom: 16, borderColor: '#fbe6e6', background: '#fff8f8', color: '#b23b3b' }}>
          {error}
        </div>
      )}

      <div className="tarjetas-grid">
        <div className="tarjeta">
          <div className="tarjeta-label">Humedad actual <span>💧</span></div>
          <div className="tarjeta-valor verde">{lectura ? `${Number(lectura.humedad).toFixed(0)}%` : '--'}</div>
        </div>
        <div className="tarjeta">
          <div className="tarjeta-label">Lecturas hoy <span>📈</span></div>
          <div className="tarjeta-valor">{historialGrafico.length}</div>
        </div>
        <div className="tarjeta">
          <div className="tarjeta-label">Estado ESP32 <span>📡</span></div>
          <div className="tarjeta-valor" style={{ fontSize: 18, color: conectado ? '#3aa05a' : '#d64545' }}>
            {conectado ? 'Conectado' : 'Sin conexión'}
          </div>
        </div>
        <div className="tarjeta">
          <div className="tarjeta-label">Señal WiFi <span>📶</span></div>
          <div className="tarjeta-valor" style={{ fontSize: 18 }}>{lectura?.senal_wifi ? `${lectura.senal_wifi} dBm` : '--'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 16, marginBottom: 16 }}>
        <div className="panel">
          <div className="panel-header">
            <h3>Medidor de Humedad</h3>
            <span className="etiqueta-tiempo-real">Tiempo real</span>
          </div>
          <div className="medidor-contenedor">
            <div className="medidor-numero">{lectura ? `${Number(lectura.humedad).toFixed(0)}%` : '--'}</div>
            <div className="medidor-label">Humedad</div>
            <div style={{ margin: '14px 0' }}>
              <span className={`pill ${pill.clase}`}>{pill.texto}</span>
            </div>
            <button className="boton-primario">💧 Regar Ahora</button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Estado de la planta</h3>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <span className={`pill ${pill.clase}`}>{pill.texto}</span>
              <p style={{ fontSize: 13, color: '#6b7d72', marginTop: 8 }}>
                {pill.clase === 'saludable'
                  ? 'Tu planta está en perfectas condiciones. Sigue así.'
                  : 'Tu planta necesita atención pronto.'}
              </p>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{lectura ? `${Number(lectura.humedad).toFixed(0)}%` : '--'}</div>
          </div>

          <h4 style={{ fontSize: 13, color: '#6b7d72', marginBottom: 8 }}>Evolución de Humedad</h4>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={historialGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2ef" />
              <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="humedad" stroke="#3aa05a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TarjetaEstadoInteligente />

        <div className="panel">
          <h3 style={{ marginTop: 0, marginBottom: 14 }}>Estado del sistema</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: '#6b7d72' }}>⚡ Voltaje ESP32</div>
              <div style={{ fontWeight: 700 }}>{lectura?.voltaje ? `${lectura.voltaje}V` : '--'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#6b7d72' }}>📶 Señal WiFi</div>
              <div style={{ fontWeight: 700 }}>{lectura?.senal_wifi ? `${lectura.senal_wifi} dBm` : '--'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#6b7d72' }}>💾 Registros guardados</div>
              <div style={{ fontWeight: 700 }}>{historialGrafico.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#6b7d72' }}>🔌 Conexión</div>
              <div style={{ fontWeight: 700, color: conectado ? '#3aa05a' : '#d64545' }}>{conectado ? 'Activa' : 'Inactiva'}</div>
            </div>
          </div>
        </div>
      </div>

      <SeccionRecomendacionesIA recomendaciones={recomendacionesIA} />
    </Layout>
  );
}
