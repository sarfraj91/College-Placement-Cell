import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../../services/api";
import "./AdminProfile.css";

// ✅ Read-only admin profile view
const AdminProfileView = () => {
  const [admin, setAdmin] = useState(null);
  const [status, setStatus] = useState({ error: "", loading: false });

  useEffect(() => {
    const load = async () => {
      setStatus({ error: "", loading: true });
      try {
        const res = await API.get("/admin/profile");
        setAdmin(res.data.admin);
        setStatus({ error: "", loading: false });
      } catch (err) {
        setStatus({
          error: err.response?.data?.message || "Failed to load profile",
          loading: false,
        });
      }
    };
    load();
  }, []);

  if (status.loading) {
    return <div className="page-shell"><div className="page-inner">Loading…</div></div>;
  }

  if (!admin) {
    return (
      <div className="page-shell">
        <div className="page-inner">
          {status.error || "No admin profile found"}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-inner admin-profile">
        <div className="admin-profile-card glass-card">
          <div className="admin-profile-main">
            <img
              src={admin.avatar?.secure_url || "/default-avatar.png"}
              className="admin-profile-avatar"
              alt="admin avatar"
            />
            <div>
              <h2 className="section-title">Admin Profile</h2>
              <p className="muted">{admin.email}</p>
              <p className="muted">{admin.phone || "Phone not added"}</p>
            </div>
          </div>

          <div className="admin-profile-actions">
            <Link to="/admin/profile/edit" className="btn-primary">
              Edit Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfileView;
