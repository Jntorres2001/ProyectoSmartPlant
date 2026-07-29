import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../services/api';

export default function VerificarOtp() {
  const location = useLocation();
  const navigate = useNavigate();
  const correoInicial = location.state?.correo || '';

  const [correo, setCorreo] = useState(correoInicial);
  const [codigo, setCodigo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setError('');
    setMensaje('');
    setCargando(true);
    try {
      await api.verificarOtp(correo, codigo);
      setMensaje('✅ Correo verificado correctamente. Ya puedes usar todas las funciones de SmartPlant.');
      setTimeout(() => navigate('/dashboard'), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function reenviarCodigo() {
    setError('');
    setMensaje('');
    setReenviando(true);
    try {
      await api.reenviarOtp(correo);
      setMensaje('📩 Te enviamos un nuevo código a tu correo.');
    } catch (err) {
      setError(err.message);
    } finally {
      setReenviando(false);
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

        <h2 style={{ marginBottom: 4 }}>Verifica tu cuenta</h2>
        <p style={{ color: '#6b7d72', marginTop: 0, marginBottom: 24, fontSize: 14 }}>
          Te enviamos un código de 6 dígitos a tu correo. Ingrésalo para activar tu cuenta.
        </p>

        <form onSubmit={manejarSubmit}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Correo electrónico</label>
          <input
            type="email"
            className="login-input"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
          />

          <label style={{ fontSize: 13, fontWeight: 600 }}>Código de verificación</label>
          <input
            type="text"
            className="login-input"
            placeholder="123456"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            style={{ letterSpacing: 6, fontWeight: 700, textAlign: 'center' }}
            required
          />

          {error && <p style={{ color: '#d64545', fontSize: 13, marginTop: -6 }}>{error}</p>}
          {mensaje && <p style={{ color: '#2f8a4c', fontSize: 13, marginTop: -6 }}>{mensaje}</p>}

          <button type="submit" className="boton-primario" disabled={cargando}>
            {cargando ? 'Verificando...' : 'Verificar cuenta'}
          </button>
        </form>

        <button
          type="button"
          className="boton-secundario"
          style={{ width: '100%', marginTop: 12 }}
          onClick={reenviarCodigo}
          disabled={reenviando || !correo}
        >
          {reenviando ? 'Reenviando...' : 'Reenviar código'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 18 }}>
          <Link to="/dashboard" style={{ color: '#3aa05a', fontWeight: 600 }}>Verificar más tarde</Link>
        </p>
      </div>

      <div className="login-panel-der">
        <div style={{ width: 64, height: 64, background: 'rgba(255,255,255,0.18)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
          📩
        </div>
        <h2 style={{ margin: 0 }}>Un último paso</h2>
        <p style={{ opacity: 0.85, maxWidth: 320 }}>
          Verificar tu correo nos ayuda a mantener tu cuenta segura y asegurarnos de que recibas tus alertas de humedad.
        </p>
      </div>
    </div>
  );
}
