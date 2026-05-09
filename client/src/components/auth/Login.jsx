import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import API from "../../services/api";
import useAuth from "../../hooks/UseAuth";
import AuthShowcase from "./AuthShowcase";
import ParticleMesh from "../ui/ParticleMesh";
import placementLogo from "../../assets/placement-logo.png";
import "./Auth.css";

const roleOptions = [
  { value: "student", label: "As Student" },
  { value: "admin", label: "As Admin" },
];

const showcaseHighlights = [
  {
    icon: Users,
    title: "Student-first dashboard",
    description: "Check openings, update your profile, and stay interview-ready.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Recruitment visibility",
    description: "Track active drives, shortlists, and every next step in one place.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    description: "Students and admins land in their own focused workspace after login.",
  },
];

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
    <div className="auth-shell">
      <div className="auth-stage">
        <ParticleMesh className="auth-stage__mesh" />
        <div className="auth-stage__halo" aria-hidden="true" />

        <div className="auth-card-shell">
          <section className="auth-card">
            <div className="auth-card__top">
              <div className="auth-card__brand">
                <img src={placementLogo} alt="Placement Cell logo" />
                <span>Placement Portal</span>
              </div>

              <div className="auth-panel__switch" aria-label="Auth pages">
                <span className="is-active">Login</span>
                <Link to="/register">Register</Link>
              </div>
            </div>

            <div className="auth-panel__header">
              <span className="auth-panel__eyebrow">Secure Access</span>
              <h1>Log in</h1>
              <p>
                Continue to your student or admin workspace with a smaller,
                cleaner portal card.
              </p>
            </div>

            {error && (
              <div className="auth-alert" role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="auth-role-toggle" aria-label="Choose a login role">
              {roleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={role === option.value ? "is-active" : ""}
                  onClick={() => setRole(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <form className="auth-form" onSubmit={handleLogin}>
              <label className="auth-field">
                <span className="auth-field__label">Email</span>
                <div className="auth-field__input">
                  <Mail size={16} />
                  <input
                    type="email"
                    placeholder="College email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </label>

              <label className="auth-field">
                <span className="auth-field__label">Password</span>
                <div className="auth-field__input">
                  <LockKeyhole size={16} />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </label>

              <div className="auth-meta">
                <span>Pick your role before login.</span>
                <Link to="/forgetPassword">Need help?</Link>
              </div>

              <button className="auth-submit" disabled={loading}>
                <span>{loading ? "Signing in..." : "Login"}</span>
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            <div className="auth-panel__footer">
              <p>
                Need a student account? <Link to="/register">Create one</Link>
              </p>
              <Link className="auth-panel__footer-link" to="/forgetPassword">
                Forgot password
              </Link>
            </div>
          </section>
        </div>

        <AuthShowcase
          title="Stay ready for each placement round."
          description="Compact access with lighter colors, role-based entry, and a floating 3D scene behind the form."
          highlights={showcaseHighlights}
        />
      </div>
    </div>
  );
};

export default Login;
