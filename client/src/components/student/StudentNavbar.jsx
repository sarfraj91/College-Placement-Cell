import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/UseAuth";
import logo from "../../assets/placement-logo.png";

const prepLinks = [
  {
    
    label: "Q&A Generator",
    to: "/preparation/qa-generator",
  },
  {
  
    label: "Mock Interview",
    to: "/preparation/mock-interview",
  },
];

const navItems = [
  { label: "Jobs", to: "/job" },
  { label: "Resume Analyzer", to: "/student/resume-analyzer" },
];

const desktopLinkClass = ({ isActive }) =>
  [
    "rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200",
    isActive
      ? "border-[#274c77] bg-[#274c77] text-[#e7ecef] shadow-[0_12px_28px_rgba(39,76,119,0.18)]"
      : "border-[#6096ba]/35 bg-[#6096ba]/16 text-[#274c77] hover:border-[#6096ba]/55 hover:bg-[#6096ba]/30 hover:text-black",
  ].join(" ");

const dropdownTagClass =
  "inline-flex items-center rounded-full border border-[#6096ba]/35 bg-[#6096ba]/16 px-4 py-2.5 text-sm font-semibold text-[#274c77] transition-all duration-150 hover:border-[#6096ba]/55 hover:bg-[#6096ba]/30 hover:text-black";
const getInitials = (fullName) =>
  (fullName || "Student")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "S";

const StudentNavbarContent = ({ location, logout, user }) => {
  const navigate = useNavigate();
  const prepRef = useRef(null);
  const profileRef = useRef(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isPrepOpen, setIsPrepOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const fullName = user?.fullname?.trim() || "Student";
  const firstName = fullName.split(" ")[0] || "Student";
  const initials = getInitials(fullName);
  const isPrepActive = location.pathname.startsWith("/preparation");

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (prepRef.current && !prepRef.current.contains(event.target)) {
        setIsPrepOpen(false);
      }

      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#6096ba]/45 bg-[#e7ecef]/95 backdrop-blur-x1">
      <div className="mx-auto flex min-h-10 max-w-330 items-center gap-4 px-4 sm:px-6 lg:px-10">
        <div className="flex flex-1 items-center">
          <Link
            to="/"
            className="group flex items-center gap-3 rounded-full px-1 py-1 transition-transform duration-200 hover:scale-[1.01]"
          >
            <img
              src={logo}
              alt="PlacementCell logo"
              className="h-11 w-11 rounded-2xl object-cover shadow-[0_10px_24px_rgba(39,76,119,0.16)]"
            />

            <div className="min-w-0">
              <span className="block text-[11px] font-medium uppercase tracking-[0.26em] text-[#6096ba]">
                Interview Prep
              </span>

              <span
                className="block truncate text-[1.35rem] leading-none text-[#274c77]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                PlacementCell
              </span>
            </div>
          </Link>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={desktopLinkClass}>
              {item.label}
            </NavLink>
          ))}

          <div className="relative" ref={prepRef}>
            <button
              type="button"
              onClick={() => setIsPrepOpen((previous) => !previous)}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200",
                isPrepOpen || isPrepActive
                  ? "border-[#274c77] bg-[#274c77] text-[#e7ecef] shadow-[0_12px_28px_rgba(39,76,119,0.18)]"
                  : "border-[#6096ba]/35 bg-[#6096ba]/16 text-[#274c77] hover:border-[#6096ba]/55 hover:bg-[#6096ba]/30 hover:text-black",
              ].join(" ")}
            >
              Preparation
              <ChevronDown
                size={14}
                className={isPrepOpen ? "rotate-180 transition-transform duration-200" : "transition-transform duration-200"}
              />
            </button>

            {isPrepOpen ? (
              <div className="absolute left-1/2 top-[calc(100%+14px)] flex w-[220px] -translate-x-1/2 flex-col gap-2">
                {prepLinks.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={dropdownTagClass}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </nav>

        <div className="hidden flex-1 items-center justify-end gap-3 lg:flex">
          <Link
            to="/student/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-[#274c77] bg-[#274c77] px-4 py-2.5 text-sm font-medium text-[#e7ecef] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#6096ba] hover:text-black"
          >
            <LayoutDashboard size={16} />
            Dashboard
          </Link>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setIsProfileOpen((previous) => !previous)}
              className="flex items-center gap-3 rounded-full border border-[#6096ba]/45 bg-[#6096ba]/18 px-3 py-2 text-black shadow-[0_12px_30px_rgba(39,76,119,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#6096ba]/28 hover:shadow-[0_18px_38px_rgba(39,76,119,0.12)]"
            >
              {user?.avatar?.secure_url ? (
                <img
                  src={user.avatar.secure_url}
                  alt={`${fullName} avatar`}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#274c77] text-sm font-semibold text-[#e7ecef]">
                  {initials}
                </div>
              )}

              <div className="hidden min-w-0 text-left xl:block">
                <span className="block truncate text-sm font-semibold text-black">
                  {firstName}
                </span>
                <span className="block text-xs text-[#274c77]">Student space</span>
              </div>

              <ChevronDown
                size={16}
                className={isProfileOpen ? "rotate-180 text-[#274c77] transition-transform duration-200" : "text-[#274c77] transition-transform duration-200"}
              />
            </button>

            {isProfileOpen ? (
              <div className="absolute right-0 top-[calc(100%+14px)] flex w-[160px] flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate("/student/view-profile");
                  }}
                  className={`${dropdownTagClass} justify-start`}
                >
                  View Profile
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className={`${dropdownTagClass} justify-start`}
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 lg:hidden">
          <Link
            to="/student/dashboard"
            className="hidden items-center gap-2 rounded-full border border-[#274c77] bg-[#274c77] px-4 py-2.5 text-sm font-medium text-[#e7ecef] shadow-[0_8px_20px_rgba(39,76,119,0.08)] transition-colors duration-200 hover:bg-[#6096ba] hover:text-black sm:inline-flex"
          >
            <LayoutDashboard size={16} />
            Dashboard
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileOpen((previous) => !previous)}
            aria-label={isMobileOpen ? "Close navigation menu" : "Open navigation menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#274c77] bg-[#274c77] text-[#e7ecef] shadow-[0_8px_20px_rgba(39,76,119,0.08)] transition-colors duration-200 hover:bg-[#6096ba] hover:text-black"
          >
            {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {isMobileOpen ? (
        <div className="border-t border-[#6096ba]/40 bg-[#e7ecef] px-4 py-4 shadow-[0_24px_50px_rgba(39,76,119,0.12)] lg:hidden">
          <div className="mx-auto max-w-[1320px] space-y-4">
            <Link
              to="/student/view-profile"
              className="flex items-center gap-3 rounded-3xl bg-[#6096ba]/20 p-4 transition-colors duration-200 hover:bg-[#6096ba]/30"
            >
              {user?.avatar?.secure_url ? (
                <img
                  src={user.avatar.secure_url}
                  alt={`${fullName} avatar`}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#274c77] text-sm font-semibold text-[#e7ecef]">
                  {initials}
                </div>
              )}

              <div className="min-w-0">
                <span className="block truncate text-base font-semibold text-[#274c77]">
                  {fullName}
                </span>
                <span className="block text-sm text-black/70">
                  Your interview preparation workspace
                </span>
              </div>
            </Link>

            <div className="grid gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      "rounded-[20px] px-4 py-3 text-sm font-medium transition-colors duration-200",
                      isActive
                        ? "bg-[#274c77] text-[#e7ecef]"
                        : "bg-[#6096ba]/18 text-black hover:bg-[#6096ba]/32",
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}

              <button
                type="button"
                onClick={() => setIsPrepOpen((previous) => !previous)}
                className={[
                  "flex items-center justify-between rounded-[20px] px-4 py-3 text-left text-sm font-medium transition-colors duration-200",
                  isPrepOpen || isPrepActive
                    ? "bg-[#274c77] text-[#e7ecef]"
                    : "bg-[#6096ba]/18 text-black hover:bg-[#6096ba]/32",
                ].join(" ")}
              >
                <span>Preparation</span>
                <ChevronDown
                  size={16}
                  className={isPrepOpen ? "rotate-180 transition-transform duration-200" : "transition-transform duration-200"}
                />
              </button>

              {isPrepOpen ? (
                <div className="grid gap-2">
                  {prepLinks.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="rounded-[20px] bg-[#6096ba]/18 px-4 py-3 text-sm font-medium text-black transition-colors duration-200 hover:bg-[#6096ba]/32 hover:text-[#274c77]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Link
                to="/student/view-profile"
                className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-[#6096ba]/18 px-4 py-3 text-sm font-semibold text-black transition-colors duration-200 hover:bg-[#6096ba]/32 hover:text-[#274c77]"
              >
                View Profile
              </Link>

              <Link
                to="/student/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-[#274c77] px-4 py-3 text-sm font-semibold text-[#e7ecef] shadow-[0_16px_32px_rgba(39,76,119,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#6096ba] hover:text-black"
              >
                <Sparkles size={16} />
                Open Dashboard
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-[#274c77] bg-[#6096ba]/16 px-4 py-3 text-sm font-semibold text-black transition-colors duration-200 hover:bg-[#274c77] hover:text-[#e7ecef]"
              >
                <LogOut size={16} />
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
};

const StudentNavbar = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navbarStateKey = location.key || `${location.pathname}${location.search}${location.hash}`;

  return (
    <StudentNavbarContent
      key={navbarStateKey}
      location={location}
      logout={logout}
      user={user}
    />
  );
};

export default StudentNavbar;
