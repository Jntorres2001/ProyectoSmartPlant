import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth();

  if (cargando) return null; // o un spinner
  if (!usuario) return <Navigate to="/login" replace />;

  return children;
}
