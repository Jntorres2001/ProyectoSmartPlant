import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const enlaces = [
  { to: '/dashboard', icono: '▦', texto: 'Panel Principal' },
  { to: '/historial', icono: '◷', texto: 'Historial' },
  { to: '/alertas', icono: '🔔', texto: 'Alertas' },
  { to: '/notificaciones', icono: '✉️', texto: 'Notificaciones' },
  { to: '/asistente-ia', icono: '🤖', texto: 'Asistente IA' },
  { to: '/diagnosticos-ia', icono: '🩺', texto: 'Diagnósticos IA' },
  { to: '/usuarios', icono: '👤', texto: 'Usuarios', soloAdmin: true },
  { to: '/configuracion', icono: '⚙', texto: 'Configuración' }
];

export default function Sidebar({ alertasSinLeer = 0 }) {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="icono">🌱</div>
        <div>
          <div className="titulo">SmartPlant</div>
          <div className="subtitulo">IOT MONITOR</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {enlaces
          .filter((enlace) => !enlace.soloAdmin || usuario?.rol === 'Administrador')
          .map((enlace) => (
            <NavLink
              key={enlace.to}
              to={enlace.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'activo' : ''}`}
            >
              <span>{enlace.icono}</span>
              <span>{enlace.texto}</span>
              {enlace.to === '/alertas' && alertasSinLeer > 0 && (
                <span className="sidebar-badge">{alertasSinLeer}</span>
              )}
              {enlace.to === '/asistente-ia' && !usuario?.esPremium && (
                <span className="sidebar-badge" title="Función Premium">🌟</span>
              )}
              {enlace.to === '/diagnosticos-ia' && !usuario?.esPremium && (
                <span className="sidebar-badge" title="Función Premium">🌟</span>
              )}
            </NavLink>
          ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={cerrarSesion}>
          <span>⏏</span> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
