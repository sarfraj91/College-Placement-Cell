import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import useAuth from "../../hooks/UseAuth";
import "./Navbar.css";

const Navbar = () => {
  const { user, loading, logout } = useAuth(); // ✅ FIX
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();              // ✅ single source of truth
    setOpen(false);
    navigate("/login", { replace: true });
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="navbar">
      {/* ================= LEFT ================= */}
      <div className="nav-left">
        <Link to="/" className="logo">PlacementCell</Link>
      </div>
       <div className="nav-left">
        <Link to="/job" className="btn primary">view jobs</Link>
      </div>

      {/* ================= RIGHT ================= */}
      <div className="nav-right">
        {loading ? null : !user ? (
          <>
            <Link to="/login" className="nav-link">Login</Link>
            <Link to="/register" className="btn primary">Register</Link>
          </>
        ) : (
          <div className="user-box" ref={dropdownRef}>
            <Link to="/student/dashboard" className="btn primary">
              Dashboard
            </Link>

            <img
              src={user.avatar?.secure_url || "/default-avatar.png"}
              className="avatar"
              alt="avatar"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((prev) => !prev);
              }}
            />

            <span className="username">
              Hello! {user.fullname}
            </span>

            {open && (
              <div className="dropdown">
                <button
                  onClick={() => {
                    setOpen(false);
                    navigate("/student/view-profile");
                  }}
                >
                  Profile
                </button>

                <button className="danger" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
