import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../../hooks/UseAuth";

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div />;

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  // ✅ Only students can access student routes
  if (role === "student" && user.role !== "student") {
    return <Navigate to="/" replace />;
  }

  if (role === "admin" && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
