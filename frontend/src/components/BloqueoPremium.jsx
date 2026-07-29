import { Link } from 'react-router-dom';
import Layout from './Layout';

export default function BloqueoPremium({ titulo, descripcion }) {
  return (
    <Layout titulo={titulo}>
      <div className="panel" style={{ textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>🔒</div>
        <h2 style={{ margin: '0 0 8px' }}>Función exclusiva para usuarios Premium</h2>
        <p style={{ color: '#6b7d72', maxWidth: 420, margin: '0 auto 24px' }}>{descripcion}</p>
        <Link
          to="/configuracion"
          className="boton-primario"
          style={{ display: 'inline-block', width: 'auto', padding: '12px 28px', textDecoration: 'none' }}
        >
          🌟 Actualizar a Premium
        </Link>
      </div>
    </Layout>
  );
}
