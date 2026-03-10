import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../../services/api";
import "./ResetPassword.css";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 8) {
      return setError("Password must be at least 8 characters");
    }

    if (password !== confirmPassword) {
      return setError("Passwords do not match");
    }

    try {
      setLoading(true);

      await API.post(`/users/reset-password/${token}`, {
        password,
      });

      setSuccess("Password reset successfully! Redirecting to login...");

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-grid">
        {/* ================= FORM ================= */}
        <div className="reset-card">
          <h2>Reset Your Password</h2>
          <p className="subtitle">
            Create a strong new password for your account
          </p>

          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>New Password</label>
              <input
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button className="reset-btn" type="submit" disabled={loading}>
              {loading ? "Updating..." : "Reset Password"}
            </button>
          </form>

          <p className="back-login" onClick={() => navigate("/login")}>
            ← Back to Login
          </p>
        </div>

        {/* ================= VISUAL ================= */}
        <aside className="auth-visual">
          <div className="auth-orb" />
          <div className="auth-panel">
            <h3>Protected Account</h3>
            <p className="muted">
              Set a strong password and continue your placement journey safely.
            </p>
            <span className="badge">Encrypted</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ResetPassword;
