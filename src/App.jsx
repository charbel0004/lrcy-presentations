import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Spin from "./pages/Spin";
import Result from "./pages/Result";
import AdminPanel from "./pages/AdminPanel";
import BootstrapAdmin from "./pages/BootstrapAdmin";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/bootstrap-admin" element={<BootstrapAdmin />} />

      {/* Presenter */}
      <Route
        path="/spin"
        element={
          <ProtectedRoute role="presenter">
            <Spin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/result"
        element={
          <ProtectedRoute role="presenter">
            <Result />
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminPanel />
          </ProtectedRoute>
        }
      />

      {/* Default */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
