import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import useAuth from "../../hooks/UseAuth";
import "./AdminNavbar.css";

const AdminNavbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="admin-navbar">
      <div className="admin-navbar-inner">
        {/* ================= BRAND ================= */}
        <Link to="/admin/dashboard" className="admin-brand">
          PlacementCell Admin
        </Link>

        {/* ================= PRIMARY ================= */}
        <Link to="/admin/filter-students" className="admin-link">
          Filter Students
        </Link>
        <Link to="/admin/post-job" className="admin-link">
          Add Job
        </Link>

        {/* ================= ACTIONS ================= */}
        <div className="admin-actions">
          {!user ? (
            <>
              <Link to="/login" className="admin-link">
                Login
              </Link>

              <Link to="/register" className="btn-primary">
                Signup
              </Link>
            </>
          ) : (
            <>
              <Link to="/admin/dashboard" className="admin-link">
                Dashboard
              </Link>

              {/* ================= ADMIN PROFILE ================= */}
              <div className="admin-user" ref={dropdownRef}>
                <img
                  src={user.avatar?.secure_url || "/default-avatar.png"}
                  className="admin-avatar"
                  alt="admin avatar"
                  onClick={() => setOpen((prev) => !prev)}
                />
                <span className="admin-name">{user.fullname}</span>

                {open && (
                  <div className="admin-dropdown">
                    <button
                      onClick={() => {
                        setOpen(false);
                        navigate("/admin/profile");
                      }}
                    >
                      View Profile
                    </button>
                    <button
                      onClick={() => {
                        setOpen(false);
                        navigate("/admin/profile/edit");
                      }}
                    >
                      Edit Profile
                    </button>
                    <button className="danger" onClick={handleLogout}>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default AdminNavbar;
