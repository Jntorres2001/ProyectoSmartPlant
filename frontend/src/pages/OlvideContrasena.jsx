import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function OlvideContrasena() {
  const [correo, setCorreo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setError('');
    setMensaje('');
    setCargando(true);
    try {
      const respuesta = await api.solicitarRecuperacion(correo);
      setMensaje(respuesta.mensaje || 'Si el correo existe, recibirás un enlace de recuperación en breve.');
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

        <h2 style={{ marginBottom: 4 }}>¿Olvidaste tu contraseña?</h2>
        <p style={{ color: '#6b7d72', marginTop: 0, marginBottom: 24, fontSize: 14 }}>
          Ingresa tu correo y te enviaremos un enlace para restablecerla.
        </p>

        <form onSubmit={manejarSubmit}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Correo electrónico</label>
          <input
            type="email"
            className="login-input"
            placeholder="usuario@smartplant.io"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
          />

          {error && <p style={{ color: '#d64545', fontSize: 13, marginTop: -6 }}>{error}</p>}
          {mensaje && <p style={{ color: '#2f8a4c', fontSize: 13, marginTop: -6 }}>{mensaje}</p>}

          <button type="submit" className="boton-primario" disabled={cargando}>
            {cargando ? 'Enviando...' : 'Enviar enlace de recuperación'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 18 }}>
          <Link to="/login" style={{ color: '#3aa05a', fontWeight: 600 }}>Volver a inicio de sesión</Link>
        </p>
      </div>

      <div className="login-panel-der">
        <div style={{ width: 64, height: 64, background: 'rgba(255,255,255,0.18)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
          🔒
        </div>
        <h2 style={{ margin: 0 }}>Tu cuenta, siempre segura</h2>
        <p style={{ opacity: 0.85, maxWidth: 320 }}>
          Te mandaremos un enlace temporal a tu correo para que puedas crear una nueva contraseña.
        </p>
      </div>
    </div>
  );
}
