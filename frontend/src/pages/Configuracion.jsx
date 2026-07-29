import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID;
const PRECIO_PREMIUM_USD = 4.99;

export default function Configuracion() {
  const { usuario, actualizarUsuarioLocal } = useAuth();
  const [dispositivo, setDispositivo] = useState(null);
  const [notificaciones, setNotificaciones] = useState({ correo: true, push: true, sms: false });
  const [perfil, setPerfil] = useState({ nombre: usuario?.nombre || '', correo: usuario?.correo || '' });
  const [mensaje, setMensaje] = useState('');
  const [mensajePago, setMensajePago] = useState('');
  const [cargandoPayphone, setCargandoPayphone] = useState(false);
  const contenedorPaypalRef = useRef(null);

  useEffect(() => {
    api.obtenerDispositivos().then((lista) => setDispositivo(lista[0] || null)).catch(() => {});
  }, []);

  // ---------- Carga y renderiza el botón de PayPal (Sandbox) ----------
  useEffect(() => {
    if (usuario?.esPremium || !PAYPAL_CLIENT_ID) return;

    const scriptId = 'paypal-sdk-smartplant';
    function renderizarBotonesPaypal() {
      if (!window.paypal || !contenedorPaypalRef.current) return;
      contenedorPaypalRef.current.innerHTML = '';
      window.paypal
        .Buttons({
          style: { layout: 'horizontal', color: 'gold', shape: 'pill', label: 'pay', height: 40 },
          createOrder: async () => {
            const { id } = await api.crearOrdenPaypal(PRECIO_PREMIUM_USD);
            return id;
          },
          onApprove: async (data) => {
            try {
              const respuesta = await api.capturarOrdenPaypal(data.orderID);
              setMensajePago(`🎉 ${respuesta.mensaje || 'Pago aprobado. Suscripción Premium activada.'}`);
              actualizarUsuarioLocal({ esPremium: true, premiumHasta: respuesta.premiumHasta });
            } catch (err) {
              setMensajePago(`❌ ${err.message}`);
            }
          },
          onError: () => setMensajePago('❌ Ocurrió un error al procesar el pago con PayPal')
        })
        .render(contenedorPaypalRef.current);
    }

    if (document.getElementById(scriptId)) {
      renderizarBotonesPaypal();
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
    script.onload = renderizarBotonesPaypal;
    document.body.appendChild(script);
  }, [usuario]);

  // ---------- PayPhone: redirige a la página de pago hospedada por PayPhone ----------
  // (Ya no depende de ningún SDK/script externo embebible: solo llama a la API REST
  // de PayPhone en el backend y redirige el navegador a la URL de pago que devuelve).
  async function pagarConPayphone() {
    setCargandoPayphone(true);
    setMensajePago('');
    try {
      const { urlPago } = await api.crearPagoPayphone(PRECIO_PREMIUM_USD);
      window.location.href = urlPago;
    } catch (err) {
      setMensajePago(`❌ ${err.message}`);
      setCargandoPayphone(false);
    }
  }

  async function guardarDispositivo() {
    if (!dispositivo) return;
    await api.actualizarDispositivo(dispositivo.id, dispositivo);
    setMensaje('Configuración del dispositivo guardada ✅');
    setTimeout(() => setMensaje(''), 2500);
  }

  async function guardarPerfil(evento) {
    evento.preventDefault();
    await api.actualizarMiPerfil(perfil);
    setMensaje('Perfil actualizado ✅');
    setTimeout(() => setMensaje(''), 2500);
  }

  return (
    <Layout titulo="Configuración">
      {mensaje && (
        <div className="panel" style={{ marginBottom: 16, background: '#e8f5ec', borderColor: '#cfe8d6', color: '#2f6b40' }}>
          {mensaje}
        </div>
      )}

      <div className="panel" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>⚙ Configuración del ESP32</h3>
        {dispositivo ? (
          <>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Nombre del dispositivo</label>
            <input
              className="login-input"
              value={dispositivo.nombre_dispositivo}
              onChange={(e) => setDispositivo({ ...dispositivo, nombre_dispositivo: e.target.value })}
            />

            <label style={{ fontSize: 13, fontWeight: 600 }}>Red WiFi (SSID)</label>
            <input
              className="login-input"
              value={dispositivo.ssid || ''}
              onChange={(e) => setDispositivo({ ...dispositivo, ssid: e.target.value })}
            />

            <label style={{ fontSize: 13, fontWeight: 600 }}>Intervalo de lectura</label>
            <select
              className="login-input"
              value={dispositivo.intervalo_lectura_segundos}
              onChange={(e) => setDispositivo({ ...dispositivo, intervalo_lectura_segundos: Number(e.target.value) })}
            >
              <option value={15}>Cada 15 segundos</option>
              <option value={30}>Cada 30 segundos</option>
              <option value={60}>Cada 1 minuto</option>
              <option value={300}>Cada 5 minutos</option>
            </select>

            <h4 style={{ fontSize: 14, marginTop: 18 }}>💧 Límites de Humedad</h4>
            <label style={{ fontSize: 13 }}>Humedad mínima (alerta): {dispositivo.humedad_minima_alerta}%</label>
            <input
              type="range"
              min={10}
              max={60}
              value={dispositivo.humedad_minima_alerta}
              onChange={(e) => setDispositivo({ ...dispositivo, humedad_minima_alerta: Number(e.target.value) })}
              style={{ width: '100%', margin: '8px 0 16px' }}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={dispositivo.riego_automatico}
                onChange={(e) => setDispositivo({ ...dispositivo, riego_automatico: e.target.checked })}
              />
              Riego automático — activar cuando la humedad baje del límite
            </label>

            <button className="boton-primario" style={{ width: 'auto', marginTop: 16 }} onClick={guardarDispositivo}>
              Guardar cambios
            </button>
          </>
        ) : (
          <p style={{ color: '#6b7d72' }}>No hay dispositivos registrados todavía.</p>
        )}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>🔔 Notificaciones</h3>
        {[
          { clave: 'correo', label: 'Notificaciones por correo', desc: 'Recibir alertas en tu email' },
          { clave: 'push', label: 'Notificaciones push', desc: 'Alertas en el navegador' },
          { clave: 'sms', label: 'Notificaciones SMS', desc: 'Mensajes de texto al celular' }
        ].map((n) => (
          <div key={n.clave} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f6f4' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{n.label}</div>
              <div style={{ fontSize: 12, color: '#6b7d72' }}>{n.desc}</div>
            </div>
            <input
              type="checkbox"
              checked={notificaciones[n.clave]}
              onChange={(e) => setNotificaciones({ ...notificaciones, [n.clave]: e.target.checked })}
            />
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>🌟 Suscripción Premium</h3>

        {usuario?.esPremium ? (
          <div style={{ background: '#f0f8f2', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontWeight: 700, color: '#2f8a4c', fontSize: 15 }}>✅ Ya tienes Premium activo</div>
            {usuario?.premiumHasta && (
              <div style={{ fontSize: 13, color: '#6b7d72', marginTop: 4 }}>
                Vigente hasta: {new Date(usuario.premiumHasta).toLocaleDateString('es-ES')}
              </div>
            )}
          </div>
        ) : (
          <>
            <p style={{ color: '#6b7d72', fontSize: 13, marginTop: -4, marginBottom: 16 }}>
              Desbloquea reportes ilimitados y alertas prioritarias por ${PRECIO_PREMIUM_USD}/mes.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Pagar con PayPal</div>
                <div ref={contenedorPaypalRef} />
                {!PAYPAL_CLIENT_ID && (
                  <p style={{ fontSize: 12, color: '#9aa79f' }}>
                    Configura VITE_PAYPAL_CLIENT_ID en el .env del frontend
                  </p>
                )}
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Pagar con PayPhone</div>
                <button
                  type="button"
                  className="boton-primario"
                  style={{ width: 'auto' }}
                  onClick={pagarConPayphone}
                  disabled={cargandoPayphone}
                >
                  {cargandoPayphone ? 'Redirigiendo...' : '📲 Pagar con PayPhone'}
                </button>
                <p style={{ fontSize: 11, color: '#9aa79f', marginTop: 6 }}>
                  Serás redirigido a la página segura de PayPhone para completar el pago.
                </p>
              </div>
            </div>

            {mensajePago && (
              <p style={{ fontSize: 13, color: mensajePago.startsWith('❌') ? '#d64545' : '#2f8a4c', marginTop: 14 }}>
                {mensajePago}
              </p>
            )}
          </>
        )}
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>👤 Perfil del Usuario</h3>
        <form onSubmit={guardarPerfil} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Nombre completo</label>
            <input className="login-input" value={perfil.nombre} onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Correo electrónico</label>
            <input className="login-input" value={perfil.correo} onChange={(e) => setPerfil({ ...perfil, correo: e.target.value })} />
          </div>
          <button type="submit" className="boton-primario" style={{ gridColumn: '1 / -1', width: 'auto' }}>
            💾 Guardar Cambios
          </button>
        </form>
      </div>
    </Layout>
  );
}
