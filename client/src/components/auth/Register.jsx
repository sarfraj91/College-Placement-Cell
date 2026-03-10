import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../../services/api";
import "./Register.css";

const Register = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullname: "",
    email: "",
    password: "",
  });

  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAvatar(file);
    setPreview(URL.createObjectURL(file));
  };

  // ✅ Simple frontend validation for college email domain
  const isCollegeEmail = (value) =>
    value.toLowerCase().trim().endsWith("@mitmeerut.ac.in");

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    // ✅ Frontend validation
    if (!isCollegeEmail(form.email)) {
      setError("Email must end with @mitmeerut.ac.in");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("fullname", form.fullname);
      formData.append("email", form.email);
      formData.append("password", form.password);
      if (avatar) formData.append("avatar", avatar);

      await API.post("/users/register", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // ✅ Go to OTP verification screen
      navigate("/verify-email", { state: { email: form.email } });
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="register-wrapper">
      <div className="auth-grid">
        {/* ================= FORM ================= */}
        <form className="register-card" onSubmit={handleRegister}>
          <h2>Create Account</h2>
          <p className="subtitle">Student Registration</p>

          {error && <p className="error-text">{error}</p>}

          {/* ================= AVATAR UPLOAD ================= */}
          <div className="avatar-upload">
            <label htmlFor="avatar-input">
              <div className="avatar-circle">
                {preview ? (
                  <img src={preview} alt="avatar preview" />
                ) : (
                  <span>+</span>
                )}
              </div>
            </label>
            <input
              id="avatar-input"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              hidden
            />
            <small>Upload Profile Picture</small>
          </div>

          <input
            name="fullname"
            placeholder="Full Name"
            onChange={handleChange}
            required
          />
          <input
            name="email"
            placeholder="College Email"
            onChange={handleChange}
            required
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            onChange={handleChange}
            required
          />

          <button type="submit">Register</button>

          <p className="redirect-text">
            Already have an account? <Link to="/login">Login</Link>
          </p>

          <p className="redirect-text">
            <Link to="/">← Back to Home</Link>
          </p>
        </form>

        {/* ================= VISUAL ================= */}
        <aside className="register-visual">
          <div className="register-orb" />
          <div className="register-panel">
            <h3>Build Your Profile</h3>
            <p className="muted">
              Keep documents, scores, and skills organized so admins can
              shortlist faster and more accurately.
            </p>
            <div className="register-tags">
              <span className="badge">Profile Ready</span>
              <span className="badge">Shortlist Fast</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Register;
