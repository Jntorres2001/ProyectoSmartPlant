import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';

export default function RestablecerContrasena() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setError('');
    setMensaje('');

    if (password !== confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (!token) {
      setError('El enlace de recuperación no es válido. Solicita uno nuevo.');
      return;
    }

    setCargando(true);
    try {
      const respuesta = await api.restablecerContrasena(token, password);
      setMensaje(respuesta.mensaje || 'Contraseña actualizada correctamente.');
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login-layout">
      <div className="login-panel-izq">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <span style={{ fontSize: 26 }}>🌱</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>SmartPlant</div>
            <div style={{ fontSize: 11, color: '#6b7d72' }}>IOT MONITOR</div>
          </div>
        </div>

        <h2 style={{ marginBottom: 4 }}>Restablecer contraseña</h2>
        <p style={{ color: '#6b7d72', marginTop: 0, marginBottom: 24, fontSize: 14 }}>
          Crea una nueva contraseña para tu cuenta.
        </p>

        {!token && (
          <p style={{ color: '#d64545', fontSize: 13, marginBottom: 16 }}>
            No se encontró un token de recuperación en el enlace. Solicita uno nuevo desde{' '}
            <Link to="/olvide-contrasena" style={{ color: '#3aa05a', fontWeight: 600 }}>aquí</Link>.
          </p>
        )}

        <form onSubmit={manejarSubmit}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Nueva contraseña</label>
          <input
            type="password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          <label style={{ fontSize: 13, fontWeight: 600 }}>Confirmar contraseña</label>
          <input
            type="password"
            className="login-input"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            minLength={6}
            required
          />

          {error && <p style={{ color: '#d64545', fontSize: 13, marginTop: -6 }}>{error}</p>}
          {mensaje && <p style={{ color: '#2f8a4c', fontSize: 13, marginTop: -6 }}>{mensaje}</p>}

          <button type="submit" className="boton-primario" disabled={cargando || !token}>
            {cargando ? 'Guardando...' : 'Restablecer contraseña'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 18 }}>
          <Link to="/login" style={{ color: '#3aa05a', fontWeight: 600 }}>Volver a inicio de sesión</Link>
        </p>
      </div>

      <div className="login-panel-der">
        <div style={{ width: 64, height: 64, background: 'rgba(255,255,255,0.18)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
          🔑
        </div>
        <h2 style={{ margin: 0 }}>Casi listo</h2>
        <p style={{ opacity: 0.85, maxWidth: 320 }}>
          Elige una contraseña segura para volver a acceder a tu panel de SmartPlant.
        </p>
      </div>
    </div>
  );
}
