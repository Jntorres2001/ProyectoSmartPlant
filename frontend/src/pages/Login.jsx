import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Login() {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const botonGoogleRef = useRef(null);
  const { login, loginConGoogle } = useAuth();
  const navigate = useNavigate();

  // Carga el botón de Google Sign-In cuando el script esté disponible
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (respuesta) => {
        try {
          await loginConGoogle(respuesta.credential);
          navigate('/dashboard');
        } catch (err) {
          setError(err.message);
        }
      }
    });

    window.google.accounts.id.renderButton(botonGoogleRef.current, {
      theme: 'outline',
      size: 'large',
      width: 340
    });
  }, []);

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setError('');
    setCargando(true);
    try {
      await login(correo, password);
      navigate('/dashboard');
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

        <h2 style={{ marginBottom: 4 }}>Bienvenido de vuelta</h2>
        <p style={{ color: '#6b7d72', marginTop: 0, marginBottom: 24, fontSize: 14 }}>
          Inicia sesión para monitorear tus plantas
        </p>

        {/* Si configuras VITE_GOOGLE_CLIENT_ID, este div renderiza el botón real de Google */}
        <div ref={botonGoogleRef} style={{ marginBottom: 16 }} />
        {!GOOGLE_CLIENT_ID && (
          <button type="button" className="login-boton-google" disabled title="Configura VITE_GOOGLE_CLIENT_ID">
            <span>G</span> Continuar con Google
          </button>
        )}

        <div style={{ textAlign: 'center', color: '#9aa79f', fontSize: 12, margin: '16px 0' }}>o con email</div>

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

          <label style={{ fontSize: 13, fontWeight: 600 }}>Contraseña</label>
          <input
            type="password"
            className="login-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 14 }}>
            <Link to="/olvide-contrasena" style={{ fontSize: 12, color: '#3aa05a', fontWeight: 600 }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          {error && <p style={{ color: '#d64545', fontSize: 13, marginTop: -6 }}>{error}</p>}

          <button type="submit" className="boton-primario" disabled={cargando}>
            {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 18 }}>
          ¿No tienes cuenta? <Link to="/registro" style={{ color: '#3aa05a', fontWeight: 600 }}>Regístrate</Link>
        </p>
      </div>

      <div className="login-panel-der">
        <div style={{ width: 64, height: 64, background: 'rgba(255,255,255,0.18)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
          🌱
        </div>
        <h2 style={{ margin: 0 }}>Monitoreo inteligente de plantas</h2>
        <p style={{ opacity: 0.85, maxWidth: 320 }}>
          Conecta tu ESP32, visualiza datos en tiempo real y mantén tus plantas siempre saludables con tecnología IoT avanzada.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          {['💧 Humedad en tiempo real', '📡 Conexión inalámbrica', '📊 Análisis avanzado'].map((texto) => (
            <div key={texto} style={{ background: 'rgba(255,255,255,0.12)', padding: '10px 12px', borderRadius: 10, fontSize: 11, maxWidth: 100 }}>
              {texto}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
