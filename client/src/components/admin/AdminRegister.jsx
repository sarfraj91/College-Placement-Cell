import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import "./AdminRegister.css";

const AdminRegister = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullname: "",
    email: "",
    password: "",
  });
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  // ✅ Basic email format validation (no domain restriction for admin)
  const isValidEmail = (value) => /.+@.+\..+/.test(value.trim());

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatar(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    // ✅ Frontend validation
    if (!isValidEmail(form.email)) {
      setError("Please enter a valid email address");
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

      await API.post("/admin/register", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // ✅ Go to admin OTP verification
      navigate("/admin/verify-email", { state: { email: form.email } });
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-grid">
        {/* ================= FORM ================= */}
        <form className="admin-register-card" onSubmit={handleRegister}>
          <h2>Admin Registration</h2>
          <p className="subtitle">Hidden access for placement admins</p>

          {error && <p className="alert error">{error}</p>}

          {/* ================= AVATAR ================= */}
          <div className="avatar-upload">
            <label htmlFor="admin-avatar-input">
              <div className="avatar-circle">
                {preview ? <img src={preview} alt="avatar preview" /> : <span>+</span>}
              </div>
            </label>
            <input
              id="admin-avatar-input"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              hidden
            />
            <small>Upload Admin Avatar</small>
          </div>

          <input
            name="fullname"
            placeholder="Full Name"
            onChange={handleChange}
            required
          />
          <input
            name="email"
            placeholder="Admin Email"
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

          <button type="submit">Register Admin</button>
        </form>

        {/* ================= VISUAL ================= */}
        <aside className="auth-visual">
          <div className="auth-orb" />
          <div className="auth-panel">
            <h3>Admin Access</h3>
            <p className="muted">
              Admin accounts are verified by OTP to secure placement data.
            </p>
            <span className="badge">Verified Admin</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AdminRegister;
