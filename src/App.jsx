import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login.jsx";
import Spin from "./pages/Spin.jsx";
import Result from "./pages/Result.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";
import BootstrapAdmin from "./pages/BootstrapAdmin.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import EvaluatorPanel from "./pages/EvaluatorPanel.jsx";

export default function App() {
  return (
    <Routes>
      {/* Default */}
      <Route path="/" element={<Navigate to="/login" replace />} />

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

      {/* ✅ ADMIN EVALUATION */}
      <Route
        path="/admin/evaluate/:presenterId"
        element={
          <ProtectedRoute role="admin">
            <EvaluatorPanel />
          </ProtectedRoute>
        }
      />

      {/* Evaluator */}
      <Route
        path="/evaluator"
        element={
          <ProtectedRoute role="evaluator">
            <EvaluatorPanel />
          </ProtectedRoute>
        }
      />

      {/* Not found */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
