import { Navigate } from "react-router-dom";
import useAuth from "../../hooks/UseAuth";

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div />;

  if (user) {
    // Admin always goes to admin dashboard
    if (user.role === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    }

    // Student with incomplete profile
    if (!user.profileCompleted) {
      return <Navigate to="/student/complete-profile" replace />;
    }

    // Student with completed profile
    return <Navigate to="/student/dashboard" replace />;
  }

  return children;
};

export default PublicRoute;
