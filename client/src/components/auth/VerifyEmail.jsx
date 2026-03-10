import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import API from "../../services/api";
import "./VerifyEmail.css";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(location.state?.email || "");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState({ error: "", success: "", loading: false });

  // ✅ Frontend validation for college email domain
  const isCollegeEmail = (value) =>
    value.toLowerCase().trim().endsWith("@mitmeerut.ac.in");

  const handleVerify = async (e) => {
    e.preventDefault();
    setStatus({ error: "", success: "", loading: true });

    if (!isCollegeEmail(email)) {
      setStatus({ error: "Email must end with @mitmeerut.ac.in", success: "", loading: false });
      return;
    }
    if (!otp || otp.length !== 6) {
      setStatus({ error: "Enter a valid 6-digit OTP", success: "", loading: false });
      return;
    }

    try {
      await API.post("/users/verify-email", { email, otp });
      setStatus({ error: "", success: "Email verified. You can login now.", loading: false });
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setStatus({
        error: err.response?.data?.message || "OTP verification failed",
        success: "",
        loading: false,
      });
    }
  };

  const handleResend = async () => {
    setStatus({ error: "", success: "", loading: true });

    if (!isCollegeEmail(email)) {
      setStatus({ error: "Email must end with @mitmeerut.ac.in", success: "", loading: false });
      return;
    }

    try {
      const res = await API.post("/users/resend-otp", { email });
      setStatus({ error: "", success: res.data.message, loading: false });
    } catch (err) {
      setStatus({
        error: err.response?.data?.message || "Failed to resend OTP",
        success: "",
        loading: false,
      });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-grid">
        {/* ================= FORM ================= */}
        <form className="verify-card" onSubmit={handleVerify}>
          <h2>Verify Your Email</h2>
          <p className="subtitle">
            Enter the OTP sent to your college email.
          </p>

          {status.error && <p className="alert error">{status.error}</p>}
          {status.success && <p className="alert success">{status.success}</p>}

          <label className="input-label">College Email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@mitmeerut.ac.in"
            required
          />

          <label className="input-label">OTP</label>
          <input
            type="text"
            className="input"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="6-digit code"
            maxLength={6}
            required
          />

          <button className="btn-primary" disabled={status.loading} type="submit">
            {status.loading ? "Verifying..." : "Verify Email"}
          </button>

          <button
            className="btn-ghost resend-btn"
            disabled={status.loading}
            type="button"
            onClick={handleResend}
          >
            Resend OTP
          </button>
        </form>

        {/* ================= VISUAL ================= */}
        <aside className="auth-visual">
          <div className="auth-orb" />
          <div className="auth-panel">
            <h3>Secure Access</h3>
            <p className="muted">
              Email verification keeps student data protected and accurate.
            </p>
            <span className="badge">OTP Secured</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default VerifyEmail;
