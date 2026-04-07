import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import useAuth from "../../hooks/UseAuth";
import "./Navbar.css";

const Navbar = () => {
  const { user, loading, logout } = useAuth(); // ✅ FIX
  const [open, setOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);
  const dropdownRef = useRef(null);
  const prepRef = useRef(null);
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

      if (prepRef.current && !prepRef.current.contains(e.target)) {
        setPrepOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="navbar">
      <div className="nav-left">
        <Link to="/" className="logo">PlacementCell</Link>
      </div>

      <nav className="nav-center">
        <Link to="/job" className="nav-pill-link">
          View Jobs
        </Link>

        {user?.role === "student" ? (
          <>
            <Link to="/student/resume-analyzer" className="nav-pill-link">
              Resume AI
            </Link>

            <div className="nav-menu" ref={prepRef}>
              <button
                type="button"
                className="nav-menu-button"
                onClick={() => setPrepOpen((previous) => !previous)}
              >
                Preparation
              </button>

              {prepOpen ? (
                <div className="nav-submenu">
                  <Link
                    to="/preparation/qa-generator"
                    onClick={() => setPrepOpen(false)}
                  >
                    Interview Q&amp;A Generator
                  </Link>

                  <Link
                    to="/preparation/mock-interview"
                    onClick={() => setPrepOpen(false)}
                  >
                    Mock Interview
                  </Link>
                </div>

                




              ) : null}
            </div>
          </>
        ) : null}
      </nav>

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
                setPrepOpen(false);
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
