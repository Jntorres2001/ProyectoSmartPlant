import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

// PayPhone redirige aquí (responseUrl) después de que el usuario paga,
// agregando "id" y "clientTransactionId" como query params.
export default function PayphoneRetorno() {
  const [searchParams] = useSearchParams();
  const { actualizarUsuarioLocal } = useAuth();
  const [estado, setEstado] = useState('confirmando'); // confirmando | exito | error
  const [mensaje, setMensaje] = useState('Confirmando tu pago con PayPhone...');

  useEffect(() => {
    const id = searchParams.get('id');
    const clientTransactionId = searchParams.get('clientTransactionId') || searchParams.get('clientTxId');

    if (!id || !clientTransactionId) {
      setEstado('error');
      setMensaje('No se recibió la información del pago desde PayPhone.');
      return;
    }

    api
      .confirmarPagoPayphone(id, clientTransactionId)
      .then((respuesta) => {
        actualizarUsuarioLocal({ esPremium: true, premiumHasta: respuesta.premiumHasta });
        setEstado('exito');
        setMensaje(respuesta.mensaje || 'Pago aprobado. Tu suscripción Premium ya está activa.');
      })
      .catch((err) => {
        setEstado('error');
        setMensaje(err.message || 'No se pudo confirmar el pago con PayPhone');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout titulo="Pago con PayPhone">
      <div className="panel" style={{ textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>
          {estado === 'confirmando' ? '⏳' : estado === 'exito' ? '✅' : '❌'}
        </div>
        <h2 style={{ margin: '0 0 8px' }}>
          {estado === 'confirmando' ? 'Confirmando pago...' : estado === 'exito' ? '¡Listo!' : 'Algo salió mal'}
        </h2>
        <p style={{ color: '#6b7d72', maxWidth: 420, margin: '0 auto 24px' }}>{mensaje}</p>
        {estado !== 'confirmando' && (
          <Link to="/configuracion" className="boton-primario" style={{ display: 'inline-block', width: 'auto', padding: '12px 28px', textDecoration: 'none' }}>
            Volver a Configuración
          </Link>
        )}
      </div>
    </Layout>
  );
}
