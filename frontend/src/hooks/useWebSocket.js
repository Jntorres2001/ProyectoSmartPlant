import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';

/**
 * Hook que mantiene una conexión WebSocket abierta con el backend y
 * permite reaccionar a los eventos "nueva_lectura" y "alerta" en tiempo real.
 *
 * Uso:
 *   const { conectado, ultimoMensaje } = useWebSocket((mensaje) => {
 *     if (mensaje.tipo === 'nueva_lectura') { ... actualizar UI ... }
 *   });
 */
export function useWebSocket(onMensaje) {
  const [conectado, setConectado] = useState(false);
  const socketRef = useRef(null);
  const callbackRef = useRef(onMensaje);
  callbackRef.current = onMensaje;

  const conectar = useCallback(() => {
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => setConectado(true);

    socket.onclose = () => {
      setConectado(false);
      // Reintenta la conexión cada 3 segundos si se cae
      setTimeout(conectar, 3000);
    };

    socket.onerror = () => socket.close();

    socket.onmessage = (evento) => {
      try {
        const mensaje = JSON.parse(evento.data);
        callbackRef.current?.(mensaje);
      } catch (error) {
        console.error('Mensaje WebSocket inválido', error);
      }
    };
  }, []);

  useEffect(() => {
    conectar();
    return () => socketRef.current?.close();
  }, [conectar]);

  return { conectado };
}
