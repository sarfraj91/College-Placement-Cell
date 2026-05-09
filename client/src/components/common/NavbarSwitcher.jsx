import useAuth from "../../hooks/UseAuth";
import Navbar from "./Navbar";

import AdminNavbar from "../admin/AdminNavbar";
import StudentNavbar from "../student/StudentNavbar";

const NavbarSwitcher = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Navbar />;

  if (user.role === "admin") return <AdminNavbar />;

  return <StudentNavbar />;
};

export default NavbarSwitcher;
