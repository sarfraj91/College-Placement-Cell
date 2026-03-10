import { useState } from "react";
import API from "../../services/api";
import { Link } from "react-router-dom";
import "./ForgetPassword.css";

const ForgetPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await API.post("/users/forgot-password", { email });

      setMessage(res.data.message);
      setEmail("");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-grid">
        {/* ================= FORM ================= */}
        <form className="auth-card" onSubmit={handleSubmit}>
          <h2>Forgot Password</h2>

          {error && <p className="error-text">{error}</p>}
          {message && <p className="success-text">{message}</p>}

          <input
            type="email"
            placeholder="Enter your registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          <p className="redirect-text">
            <Link to="/login">Back to Login</Link>
          </p>
        </form>

        {/* ================= VISUAL ================= */}
        <aside className="auth-visual">
          <div className="auth-orb" />
          <div className="auth-panel">
            <h3>Secure Reset</h3>
            <p className="muted">
              We’ll send a secure password reset link to your registered email.
            </p>
            <span className="badge">Fast Recovery</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ForgetPassword;
