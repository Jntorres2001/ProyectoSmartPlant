import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';

import Login from './pages/Login';
import Registro from './pages/Registro';
import Dashboard from './pages/Dashboard';
import Historial from './pages/Historial';
import Alertas from './pages/Alertas';
import Usuarios from './pages/Usuarios';
import Configuracion from './pages/Configuracion';
import OlvideContrasena from './pages/OlvideContrasena';
import RestablecerContrasena from './pages/RestablecerContrasena';
import VerificarOtp from './pages/VerificarOtp';
import Notificaciones from './pages/Notificaciones';
import AsistenteIA from './pages/AsistenteIA';
import PayphoneRetorno from './pages/PayphoneRetorno';
import DiagnosticosIA from './pages/DiagnosticosIA';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/olvide-contrasena" element={<OlvideContrasena />} />
          <Route path="/restablecer-contrasena" element={<RestablecerContrasena />} />
          <Route path="/verificar-otp" element={<VerificarOtp />} />

          <Route path="/dashboard" element={<RutaProtegida><Dashboard /></RutaProtegida>} />
          <Route path="/historial" element={<RutaProtegida><Historial /></RutaProtegida>} />
          <Route path="/alertas" element={<RutaProtegida><Alertas /></RutaProtegida>} />
          <Route path="/notificaciones" element={<RutaProtegida><Notificaciones /></RutaProtegida>} />
          <Route path="/asistente-ia" element={<RutaProtegida><AsistenteIA /></RutaProtegida>} />
          <Route path="/pago/payphone/retorno" element={<RutaProtegida><PayphoneRetorno /></RutaProtegida>} />
          <Route path="/diagnosticos-ia" element={<RutaProtegida><DiagnosticosIA /></RutaProtegida>} />
          <Route path="/usuarios" element={<RutaProtegida><Usuarios /></RutaProtegida>} />
          <Route path="/configuracion" element={<RutaProtegida><Configuracion /></RutaProtegida>} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
