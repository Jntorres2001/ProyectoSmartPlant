import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../services/api';

const ETIQUETAS_TIPO = {
  OTP: '🔐 Verificación',
  RECUPERACION: '🔑 Recuperación',
  ALERTA: '💧 Alerta',
  REPORTE: '📊 Reporte',
  PREMIUM: '🎉 Premium',
  GENERAL: '✉️ General'
};

function EstadoPill({ estado }) {
  const estilos = {
    PENDING: { background: '#fdf1de', color: '#d99a2b', texto: '⏳ Pendiente' },
    PROCESSING: { background: '#e6eefc', color: '#3671c9', texto: '⚙ Procesando' },
    SENT: { background: '#e8f5ec', color: '#2f8a40', texto: '✅ Enviado' },
    FAILED: { background: '#fbe6e6', color: '#d64545', texto: '❌ Falló' }
  };
  const estilo = estilos[estado] || estilos.PENDING;
  return (
    <span
      style={{
        padding: '4px 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: estilo.background,
        color: estilo.color
      }}
    >
      {estilo.texto}
    </span>
  );
}

export default function Notificaciones() {
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const datos = await api.obtenerNotificaciones(50);
      setNotificaciones(datos);
    } catch (err) {
      setError('No se pudo cargar el historial de notificaciones.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Se actualiza automáticamente cuando el Worker procesa un correo
  const { conectado } = useWebSocket((mensaje) => {
    if (mensaje.tipo === 'notificacion_actualizada') {
      cargar();
    }
  });

  return (
    <Layout titulo="Notificaciones">
      <div className="panel">
        <div className="panel-header">
          <h3>Historial de correos enviados</h3>
          <span className="etiqueta-tiempo-real">
            {conectado ? '🟢 Actualización en tiempo real' : '🔴 Sin conexión en tiempo real'}
          </span>
        </div>

        {error && <p style={{ color: '#d64545', fontSize: 13 }}>{error}</p>}

        <table>
          <thead>
            <tr>
              <th>Destinatario</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>Cargando...</td></tr>
            )}
            {!cargando && notificaciones.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#6b7d72' }}>Todavía no se ha enviado ningún correo</td></tr>
            )}
            {notificaciones.map((n) => (
              <tr key={n.id}>
                <td>{n.destinatario}</td>
                <td>{ETIQUETAS_TIPO[n.tipo] || n.tipo}</td>
                <td><EstadoPill estado={n.estado} /></td>
                <td>{new Date(n.creado_en).toLocaleString('es-ES')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
