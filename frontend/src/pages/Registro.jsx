import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Registro() {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const { registro } = useAuth();
  const navigate = useNavigate();

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setError('');
    setCargando(true);
    try {
      await registro(nombre, correo, password);
      navigate('/verificar-otp', { state: { correo } });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login-layout">
      <div className="login-panel-izq">
        <h2 style={{ marginBottom: 4 }}>Crear cuenta</h2>
        <p style={{ color: '#6b7d72', marginTop: 0, marginBottom: 24, fontSize: 14 }}>
          Regístrate para empezar a monitorear tus plantas
        </p>

        <form onSubmit={manejarSubmit}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Nombre completo</label>
          <input className="login-input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />

          <label style={{ fontSize: 13, fontWeight: 600 }}>Correo electrónico</label>
          <input
            type="email"
            className="login-input"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
          />

          <label style={{ fontSize: 13, fontWeight: 600 }}>Contraseña</label>
          <input
            type="password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          {error && <p style={{ color: '#d64545', fontSize: 13, marginTop: -6 }}>{error}</p>}

          <button type="submit" className="boton-primario" disabled={cargando}>
            {cargando ? 'Creando cuenta...' : 'Registrarme'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 18 }}>
          ¿Ya tienes cuenta? <Link to="/login" style={{ color: '#3aa05a', fontWeight: 600 }}>Inicia sesión</Link>
        </p>
      </div>
      <div className="login-panel-der">
        <h2 style={{ margin: 0 }}>Únete a SmartPlant</h2>
        <p style={{ opacity: 0.85, maxWidth: 320 }}>
          Empieza a cuidar tus plantas con datos reales, no con suposiciones.
        </p>
      </div>
    </div>
  );
}
