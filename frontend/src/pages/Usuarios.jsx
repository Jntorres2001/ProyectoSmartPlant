import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../services/api';

const ROLES = ['Administrador', 'Tecnico', 'Visualizador'];

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: '', correo: '', password: '', rol: 'Visualizador' });
  const [error, setError] = useState('');

  async function cargar() {
    try {
      const datos = await api.obtenerUsuarios();
      setUsuarios(datos);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crearUsuario(evento) {
    evento.preventDefault();
    setError('');
    try {
      await api.crearUsuario(nuevo);
      setMostrarForm(false);
      setNuevo({ nombre: '', correo: '', password: '', rol: 'Visualizador' });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este usuario?')) return;
    await api.eliminarUsuario(id);
    cargar();
  }

  async function alternarEstado(usuario) {
    await api.actualizarUsuario(usuario.id, {
      ...usuario,
      estado: usuario.estado === 'Activo' ? 'Inactivo' : 'Activo'
    });
    cargar();
  }

  return (
    <Layout titulo="Usuarios">
      <div className="panel">
        <div className="panel-header">
          <h3>{usuarios.length} usuarios registrados</h3>
          <button className="boton-primario" style={{ width: 'auto' }} onClick={() => setMostrarForm(!mostrarForm)}>
            + Agregar Usuario
          </button>
        </div>

        {mostrarForm && (
          <form onSubmit={crearUsuario} style={{ background: '#f7faf8', padding: 16, borderRadius: 10, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input className="login-input" placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} required />
            <input className="login-input" placeholder="Correo" type="email" value={nuevo.correo} onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })} required />
            <input className="login-input" placeholder="Contraseña" type="password" value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} required />
            <select className="login-input" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {error && <p style={{ color: '#d64545', gridColumn: '1 / -1', margin: 0 }}>{error}</p>}
            <button type="submit" className="boton-primario" style={{ gridColumn: '1 / -1' }}>Guardar usuario</button>
          </form>
        )}

        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo electrónico</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="avatar-circulo" style={{ width: 28, height: 28, fontSize: 11 }}>{u.avatar_iniciales}</div>
                  {u.nombre}
                </td>
                <td>{u.correo}</td>
                <td><span className="pill saludable">{u.rol}</span></td>
                <td>
                  <span
                    style={{ cursor: 'pointer', color: u.estado === 'Activo' ? '#3aa05a' : '#9aa79f' }}
                    onClick={() => alternarEstado(u)}
                  >
                    ● {u.estado}
                  </span>
                </td>
                <td>
                  <button onClick={() => eliminar(u.id)} style={{ border: 'none', background: 'none', color: '#d64545', cursor: 'pointer' }}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
