import { useEffect, useState } from "react";
import API from "../../services/api";
import "./AdminProfile.css";

// ✅ Admin profile edit (phone/avatar + OTP password change)
const AdminProfile = () => {
  const [admin, setAdmin] = useState(null);
  const [phone, setPhone] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState({ error: "", success: "", loading: false });

  const [otpStatus, setOtpStatus] = useState({ error: "", success: "", loading: false });
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /* ================= LOAD PROFILE ================= */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get("/admin/profile");
        setAdmin(res.data.admin);
        setPhone(res.data.admin.phone || "");
        setPreview(res.data.admin.avatar?.secure_url || "");
      } catch (err) {
        setStatus({
          error: err.response?.data?.message || "Failed to load profile",
          success: "",
          loading: false,
        });
      }
    };
    load();
  }, []);

  /* ================= UPDATE PROFILE ================= */
  const handleSave = async () => {
    setStatus({ error: "", success: "", loading: true });
    try {
      const fd = new FormData();
      fd.append("phone", phone);
      if (avatarFile) fd.append("avatar", avatarFile);

      const res = await API.put("/admin/profile", fd);
      setAdmin(res.data.admin);
      setStatus({ error: "", success: "Profile updated", loading: false });
    } catch (err) {
      setStatus({
        error: err.response?.data?.message || "Update failed",
        success: "",
        loading: false,
      });
    }
  };

  /* ================= OTP FLOW ================= */
  const sendOtp = async () => {
    setOtpStatus({ error: "", success: "", loading: true });
    try {
      const res = await API.post("/admin/password-otp");
      setOtpStatus({ error: "", success: res.data.message, loading: false });
    } catch (err) {
      setOtpStatus({
        error: err.response?.data?.message || "Failed to send OTP",
        success: "",
        loading: false,
      });
    }
  };

  const changePassword = async () => {
    setOtpStatus({ error: "", success: "", loading: true });
    if (!otp || otp.length !== 6) {
      setOtpStatus({ error: "Enter a valid 6-digit OTP", success: "", loading: false });
      return;
    }
    if (newPassword.length < 8) {
      setOtpStatus({ error: "Password must be at least 8 characters", success: "", loading: false });
      return;
    }
    if (newPassword !== confirmPassword) {
      setOtpStatus({ error: "Passwords do not match", success: "", loading: false });
      return;
    }

    try {
      const res = await API.post("/admin/change-password-otp", {
        otp,
        newPassword,
      });
      setOtpStatus({ error: "", success: res.data.message, loading: false });
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setOtpStatus({
        error: err.response?.data?.message || "Password change failed",
        success: "",
        loading: false,
      });
    }
  };

  if (!admin) {
    return <div className="page-shell"><div className="page-inner">Loading…</div></div>;
  }

  return (
    <div className="page-shell">
      <div className="page-inner admin-profile">
        {/* ================= EDIT PROFILE ================= */}
        <div className="admin-profile-card glass-card">
          <div className="admin-profile-main">
            <img
              src={preview || "/default-avatar.png"}
              className="admin-profile-avatar"
              alt="admin avatar"
            />

            <div>
              <h2 className="section-title">Edit Admin Profile</h2>
              <p className="muted">{admin.email}</p>
            </div>
          </div>

          <div className="admin-profile-fields">
            <label className="input-label">Phone (optional)</label>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
            />

            <label className="input-label">Avatar</label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setAvatarFile(file);
                setPreview(URL.createObjectURL(file));
              }}
            />

            {status.error && <p className="admin-alert error">{status.error}</p>}
            {status.success && <p className="admin-alert success">{status.success}</p>}

            <button className="btn-primary" onClick={handleSave} disabled={status.loading}>
              {status.loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* ================= PASSWORD ================= */}
        <div className="admin-profile-card glass-card">
          <h3 className="section-title">Change Password (OTP)</h3>
          <p className="muted">Send OTP to your email and update password anytime.</p>

          <div className="admin-profile-fields">
            <button className="btn-ghost" onClick={sendOtp} disabled={otpStatus.loading}>
              {otpStatus.loading ? "Sending..." : "Send OTP"}
            </button>

            <label className="input-label">OTP</label>
            <input
              className="input"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              placeholder="6-digit code"
            />

            <label className="input-label">New Password</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
            />

            <label className="input-label">Confirm Password</label>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />

            {otpStatus.error && <p className="admin-alert error">{otpStatus.error}</p>}
            {otpStatus.success && <p className="admin-alert success">{otpStatus.success}</p>}

            <button className="btn-primary" onClick={changePassword} disabled={otpStatus.loading}>
              Update Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
