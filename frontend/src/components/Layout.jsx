import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

const formateadorFecha = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

export default function Layout({ titulo, alertasSinLeer = 0, children }) {
  const { usuario } = useAuth();
  const fechaHoy = formateadorFecha.format(new Date());

  return (
    <div className="app-layout">
      <Sidebar alertasSinLeer={alertasSinLeer} />
      <div className="contenido-principal">
        <header className="topbar">
          <div>
            <h1>{titulo}</h1>
            <div className="fecha">{fechaHoy}</div>
          </div>
          <div className="topbar-acciones">
            <span style={{ fontSize: 18 }}>🔔</span>
            <div className="avatar-circulo">{usuario?.avatar || usuario?.nombre?.[0] || '?'}</div>
          </div>
        </header>
        <main className="pagina-cuerpo">{children}</main>
      </div>
    </div>
  );
}
