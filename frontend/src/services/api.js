const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function obtenerToken() {
  return localStorage.getItem('smartplant_token');
}

async function peticion(endpoint, opciones = {}) {
  const token = obtenerToken();

  const respuesta = await fetch(`${API_URL}${endpoint}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opciones.headers || {})
    }
  });

  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(datos.error || 'Error en la petición');
  }

  return datos;
}

export const api = {
  // Auth
  login: (correo, password) =>
    peticion('/auth/login', { method: 'POST', body: JSON.stringify({ correo, password }) }),
  registro: (nombre, correo, password) =>
    peticion('/auth/registro', { method: 'POST', body: JSON.stringify({ nombre, correo, password }) }),
  loginGoogle: (id_token) =>
    peticion('/auth/google', { method: 'POST', body: JSON.stringify({ id_token }) }),
  verificarOtp: (correo, codigo) =>
    peticion('/auth/verificar-otp', { method: 'POST', body: JSON.stringify({ correo, codigo }) }),
  reenviarOtp: (correo) =>
    peticion('/auth/reenviar-otp', { method: 'POST', body: JSON.stringify({ correo }) }),
  solicitarRecuperacion: (correo) =>
    peticion('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ correo }) }),
  restablecerContrasena: (token, password) =>
    peticion('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),

  // Lecturas
  obtenerLecturaActual: () => peticion('/lecturas/actual'),
  obtenerHistorial: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return peticion(`/lecturas/historial?${query}`);
  },

  // Alertas
  obtenerAlertas: (tipo) => peticion(`/alertas${tipo ? `?tipo=${tipo}` : ''}`),
  obtenerResumenAlertas: () => peticion('/alertas/resumen'),
  marcarAlertaLeida: (id) => peticion(`/alertas/${id}/leida`, { method: 'PATCH' }),

  // Usuarios
  obtenerUsuarios: () => peticion('/usuarios'),
  crearUsuario: (datos) => peticion('/usuarios', { method: 'POST', body: JSON.stringify(datos) }),
  actualizarUsuario: (id, datos) => peticion(`/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminarUsuario: (id) => peticion(`/usuarios/${id}`, { method: 'DELETE' }),

  // Dispositivos
  obtenerDispositivos: () => peticion('/dispositivos'),
  actualizarDispositivo: (id, datos) =>
    peticion(`/dispositivos/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),

  // Perfil propio
  actualizarMiPerfil: (datos) =>
    peticion('/usuarios/perfil/mi-perfil', { method: 'PUT', body: JSON.stringify(datos) }),

  // Notificaciones (historial de la cola de correos)
  obtenerNotificaciones: (limite = 50) => peticion(`/notificaciones?limite=${limite}`),

  // Reportes por correo (PDF + gráfico adjuntos)
  enviarReporte: (datos) => peticion('/reportes/enviar', { method: 'POST', body: JSON.stringify(datos) }),

  // Pagos - PayPhone
  crearPagoPayphone: (monto) => peticion('/pagos/payphone/crear', { method: 'POST', body: JSON.stringify({ monto }) }),
  confirmarPagoPayphone: (id, clientTxId) =>
    peticion('/pagos/payphone/confirmar', { method: 'POST', body: JSON.stringify({ id, clientTxId }) }),

  // Pagos - PayPal
  crearOrdenPaypal: (monto) => peticion('/pagos/paypal/crear-orden', { method: 'POST', body: JSON.stringify({ monto }) }),
  capturarOrdenPaypal: (orderID) =>
    peticion('/pagos/paypal/capturar-orden', { method: 'POST', body: JSON.stringify({ orderID }) }),

  // Asistente IA (solo Premium)
  chatIA: (mensaje, historial = [], dispositivo_id) =>
    peticion('/ai/chat', { method: 'POST', body: JSON.stringify({ mensaje, historial, dispositivo_id }) }),
  analizarPlanta: (dispositivo_id) =>
    peticion('/ai/diagnostico', { method: 'POST', body: JSON.stringify({ dispositivo_id }) }),
  obtenerDiagnosticos: () => peticion('/ai/diagnosticos'),
  obtenerEstadoInteligente: (dispositivo_id) =>
    peticion(`/ai/estado-inteligente${dispositivo_id ? `?dispositivo_id=${dispositivo_id}` : ''}`)
};

export { obtenerToken };
