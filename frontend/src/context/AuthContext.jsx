import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const usuarioGuardado = localStorage.getItem('smartplant_usuario');
    if (usuarioGuardado) {
      setUsuario(JSON.parse(usuarioGuardado));
    }
    setCargando(false);
  }, []);

  function guardarSesion(token, datosUsuario) {
    localStorage.setItem('smartplant_token', token);
    localStorage.setItem('smartplant_usuario', JSON.stringify(datosUsuario));
    setUsuario(datosUsuario);
  }

  async function login(correo, password) {
    const { token, usuario: datosUsuario } = await api.login(correo, password);
    guardarSesion(token, datosUsuario);
  }

  async function loginConGoogle(idToken) {
    const { token, usuario: datosUsuario } = await api.loginGoogle(idToken);
    guardarSesion(token, datosUsuario);
  }

  async function registro(nombre, correo, password) {
    const { token, usuario: datosUsuario } = await api.registro(nombre, correo, password);
    guardarSesion(token, datosUsuario);
  }

  function cerrarSesion() {
    localStorage.removeItem('smartplant_token');
    localStorage.removeItem('smartplant_usuario');
    setUsuario(null);
  }

  // Actualiza campos puntuales del usuario en memoria + localStorage,
  // ej. tras activar Premium, sin necesidad de volver a iniciar sesión.
  function actualizarUsuarioLocal(datosParciales) {
    setUsuario((actual) => {
      if (!actual) return actual;
      const actualizado = { ...actual, ...datosParciales };
      localStorage.setItem('smartplant_usuario', JSON.stringify(actualizado));
      return actualizado;
    });
  }

  return (
    <AuthContext.Provider
      value={{ usuario, cargando, login, loginConGoogle, registro, cerrarSesion, actualizarUsuarioLocal }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
