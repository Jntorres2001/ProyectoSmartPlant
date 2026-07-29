import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import Layout from '../components/Layout';
import { api } from '../services/api';

export default function Historial() {
  const [datos, setDatos] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [filtroFecha, setFiltroFecha] = useState('');
  const [cargando, setCargando] = useState(true);
  const [enviandoReporte, setEnviandoReporte] = useState(false);
  const [mensajeReporte, setMensajeReporte] = useState('');

  useEffect(() => {
    cargar();
  }, [pagina, filtroFecha]);

  async function cargar() {
    setCargando(true);
    try {
      const params = { pagina, limite: 10 };
      if (filtroFecha) params.desde = filtroFecha;

      const respuesta = await api.obtenerHistorial(params);
      setDatos(respuesta.datos);
      setTotalPaginas(respuesta.totalPaginas || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  async function enviarReporte() {
    setEnviandoReporte(true);
    setMensajeReporte('');
    try {
      const params = {};
      if (filtroFecha) params.desde = filtroFecha;
      const respuesta = await api.enviarReporte(params);
      setMensajeReporte(respuesta.mensaje || '📧 El reporte se está generando y llegará a tu correo en unos segundos.');
    } catch (err) {
      setMensajeReporte(`❌ ${err.message}`);
    } finally {
      setEnviandoReporte(false);
      setTimeout(() => setMensajeReporte(''), 5000);
    }
  }

  function exportarCSV() {
    const encabezado = 'Fecha,Hora,Humedad,Estado,Dispositivo\n';
    const filas = datos
      .map((d) => {
        const fecha = new Date(d.creado_en);
        return `${fecha.toLocaleDateString('es-ES')},${fecha.toLocaleTimeString('es-ES')},${d.humedad}%,${d.estado_planta},${d.nombre_dispositivo}`;
      })
      .join('\n');

    const blob = new Blob([encabezado + filas], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'historial_smartplant.csv';
    enlace.click();
  }

  const datosGrafico = [...datos].reverse().map((d) => ({
    hora: new Date(d.creado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    humedad: Number(d.humedad)
  }));

  return (
    <Layout titulo="Historial">
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <h3>Gráfico Histórico de Humedad</h3>
          <span className="etiqueta-tiempo-real">Últimas lecturas</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={datosGrafico}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2ef" />
            <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="humedad" stroke="#3aa05a" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Registros de Humedad</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="date"
              className="boton-secundario"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
            />
            <button className="boton-secundario" onClick={exportarCSV}>⬇ Exportar</button>
            <button className="boton-primario" style={{ width: 'auto' }} onClick={enviarReporte} disabled={enviandoReporte}>
              {enviandoReporte ? 'Enviando...' : '📧 Enviar reporte'}
            </button>
          </div>
        </div>

        {mensajeReporte && (
          <p style={{ fontSize: 13, color: mensajeReporte.startsWith('❌') ? '#d64545' : '#2f8a4c', marginTop: -6 }}>
            {mensajeReporte}
          </p>
        )}

        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Humedad</th>
              <th>Estado</th>
              <th>Dispositivo</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20 }}>Cargando...</td></tr>
            )}
            {!cargando && datos.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#6b7d72' }}>Sin registros todavía</td></tr>
            )}
            {datos.map((d) => {
              const fecha = new Date(d.creado_en);
              const esSaludable = d.estado_planta === 'Saludable';
              return (
                <tr key={d.id}>
                  <td>{fecha.toLocaleDateString('es-ES')}</td>
                  <td>{fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ fontWeight: 700, color: esSaludable ? '#3aa05a' : '#d99a2b' }}>{d.humedad}%</td>
                  <td>
                    <span className={`pill ${esSaludable ? 'saludable' : 'necesita-agua'}`}>
                      {esSaludable ? '🌿 Saludable' : '💧 ' + d.estado_planta}
                    </span>
                  </td>
                  <td>{d.nombre_dispositivo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <span style={{ fontSize: 13, color: '#6b7d72' }}>Página {pagina} de {totalPaginas}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="boton-secundario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>‹</button>
            <button className="boton-secundario" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>›</button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
