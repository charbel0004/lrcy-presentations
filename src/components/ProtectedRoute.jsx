import { Navigate, useLocation } from "react-router-dom";
import { getUser, isLoggedIn } from "../lib/auth";

export default function ProtectedRoute({ children, role }) {
  const location = useLocation();
  const user = getUser();

  if (!isLoggedIn() || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/spin"} replace />;
  }

  return children;
}
