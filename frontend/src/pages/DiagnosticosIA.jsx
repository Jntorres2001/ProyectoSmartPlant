import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import BloqueoPremium from '../components/BloqueoPremium';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

function pillTendencia(tendencia) {
  if (tendencia === 'Disminuyendo') return { color: '#d64545', texto: '📉 Disminuyendo' };
  if (tendencia === 'Aumentando') return { color: '#2f8a4c', texto: '📈 Aumentando' };
  return { color: '#9aa79f', texto: '➖ Estable' };
}

export default function DiagnosticosIA() {
  const { usuario } = useAuth();
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!usuario?.esPremium) return;
    api
      .obtenerDiagnosticos()
      .then(setDiagnosticos)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [usuario]);

  if (!usuario?.esPremium) {
    return (
      <BloqueoPremium
        titulo="Diagnósticos IA"
        descripcion="El historial de diagnósticos generados por la IA (manuales y automáticos) está disponible únicamente para cuentas Premium."
      />
    );
  }

  return (
    <Layout titulo="Diagnósticos IA">
      {error && (
        <div className="panel" style={{ marginBottom: 16, borderColor: '#fbe6e6', background: '#fff8f8', color: '#b23b3b' }}>
          {error}
        </div>
      )}

      {cargando ? (
        <div className="panel">Cargando diagnósticos...</div>
      ) : diagnosticos.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', color: '#6b7d72', padding: 40 }}>
          Todavía no hay diagnósticos generados. Ve a "Asistente IA" y presiona "Analizar mi planta".
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {diagnosticos.map((d) => {
            const pill = pillTendencia(d.tendencia);
            return (
              <div key={d.id} className="panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#3aa05a', textTransform: 'uppercase' }}>
                      {d.tipo === 'manual' ? '🔍 Análisis manual' : '🤖 Recomendación automática'}
                    </span>
                    <div style={{ fontSize: 13, color: '#6b7d72', marginTop: 2 }}>
                      {d.nombre_dispositivo} · {new Date(d.creado_en).toLocaleString('es-ES')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {d.humedad_actual != null && (
                      <span style={{ fontSize: 13, fontWeight: 700 }}>💧 {Number(d.humedad_actual).toFixed(0)}%</span>
                    )}
                    {d.tendencia && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: pill.color }}>{pill.texto}</span>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: 13, color: '#1f2d24', whiteSpace: 'pre-wrap', marginBottom: d.recomendaciones && d.recomendaciones !== d.diagnostico ? 10 : 0 }}>
                  {d.diagnostico}
                </p>
                {d.recomendaciones && d.recomendaciones !== d.diagnostico && (
                  <div style={{ background: '#f0f8f2', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#2f6b40' }}>
                    🤖 {d.recomendaciones}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
