import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

const TIPOS = [
  { valor: 'Todos', label: 'Todos' },
  { valor: 'Error', label: 'Error' },
  { valor: 'Advertencia', label: 'Advertencia' },
  { valor: 'Correcta', label: 'Correctas' },
  { valor: 'Info', label: 'Info' }
];

const ICONOS = {
  Error: { icono: '⛔', color: '#fbe6e6', borde: '#d64545' },
  Advertencia: { icono: '⚠', color: '#fdf1de', borde: '#d99a2b' },
  Correcta: { icono: '✅', color: '#e8f5ec', borde: '#3aa05a' },
  Info: { icono: 'ℹ', color: '#e8f0fb', borde: '#3b7dd8' }
};

function tiempoRelativo(fechaISO) {
  const diffMs = Date.now() - new Date(fechaISO).getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return 'Ahora mismo';
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h ${minutos % 60} min`;
  return `Hace ${Math.floor(horas / 24)} días`;
}

export default function Alertas() {
  const [alertas, setAlertas] = useState([]);
  const [resumen, setResumen] = useState({});
  const [filtro, setFiltro] = useState('Todos');
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    try {
      const [listaAlertas, listaResumen] = await Promise.all([
        api.obtenerAlertas(filtro !== 'Todos' ? filtro : undefined),
        api.obtenerResumenAlertas()
      ]);
      setAlertas(listaAlertas);
      const resumenMap = {};
      listaResumen.forEach((r) => (resumenMap[r.tipo] = r.cantidad));
      setResumen(resumenMap);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [filtro]);

  // Si llega una alerta nueva por WebSocket, recarga la lista automáticamente
  useWebSocket((mensaje) => {
    if (mensaje.tipo === 'alerta') {
      cargar();
    }
  });

  return (
    <Layout titulo="Alertas">
      <div className="tarjetas-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {['Error', 'Advertencia', 'Correcta', 'Info'].map((tipo) => (
          <div className="tarjeta" key={tipo}>
            <div className="tarjeta-label">{ICONOS[tipo].icono} {tipo === 'Correcta' ? 'Correctas' : tipo + 's'}</div>
            <div className="tarjeta-valor">{resumen[tipo] || 0}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              onClick={() => setFiltro(t.valor)}
              className="boton-secundario"
              style={{
                background: filtro === t.valor ? '#3aa05a' : 'white',
                color: filtro === t.valor ? 'white' : '#1f2b24',
                borderColor: filtro === t.valor ? '#3aa05a' : '#d8e2dc'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {cargando && <p style={{ color: '#6b7d72' }}>Cargando alertas...</p>}
        {!cargando && alertas.length === 0 && <p style={{ color: '#6b7d72' }}>No hay alertas para este filtro.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alertas.map((alerta) => {
            const estilo = ICONOS[alerta.tipo] || ICONOS.Info;
            return (
              <div
                key={alerta.id}
                style={{
                  background: estilo.color,
                  borderLeft: `4px solid ${estilo.borde}`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{estilo.icono} {alerta.titulo}</div>
                  <div style={{ fontSize: 13, color: '#4a5750', marginTop: 2 }}>{alerta.mensaje}</div>
                  <div style={{ fontSize: 11, color: '#8a958f', marginTop: 4 }}>{alerta.nombre_dispositivo}</div>
                </div>
                <div style={{ fontSize: 12, color: '#8a958f', whiteSpace: 'nowrap' }}>
                  {tiempoRelativo(alerta.creado_en)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
