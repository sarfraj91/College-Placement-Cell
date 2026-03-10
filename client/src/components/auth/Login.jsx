import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import API from "../../services/api";
import useAuth from "../../hooks/UseAuth";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const redirectAfterLogin = location.state?.from;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // ✅ Frontend validation for role selection
    if (!role) {
      setError("Please select a role");
      setLoading(false);
      return;
    }

    try {
      await API.post("/users/login", { email, password, role });

      const user = await fetchUser();

      if (role !== user.role) {
        setError("Unauthorized role access");
        return;
      }

      if (user.role === "admin") {
        navigate("/admin/dashboard");
        return;
      }

      // Preserve deep-link from invitation email: /student/jobs/:jobId
      if (
        redirectAfterLogin &&
        typeof redirectAfterLogin === "string" &&
        redirectAfterLogin.startsWith("/student/")
      ) {
        navigate(redirectAfterLogin);
        return;
      }

      if (!user.profileCompleted) {
        navigate("/student/complete-profile");
        return;
      }

      navigate("/student/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-grid">
        {/* ================= FORM ================= */}
        <div className="login-card">
          <h2>Welcome Back 👋</h2>
          <p className="subtitle">Login to continue</p>

          {error && <p className="error-text shake">{error}</p>}

          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                placeholder="College Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label>Login As</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                <option value="">Select Role</option>
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button className="login-btn" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="login-links">
            <Link to="/forgetPassword">Forgot password?</Link>
            <Link to="/register">Create account</Link>
          </div>
        </div>

        {/* ================= VISUAL ================= */}
        <aside className="auth-visual">
          <div className="auth-orb" />
          <div className="auth-panel">
            <h3>Placement Ready</h3>
            <p className="muted">
              Track your progress, keep documents ready, and stay aligned with
              admin filters in one modern workspace.
            </p>
            <span className="badge">Secure • Fast • Simple</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Login;
