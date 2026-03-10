import useAuth from "../../hooks/UseAuth";
import Navbar from "./Navbar";

import AdminNavbar from "../admin/AdminNavbar";

const NavbarSwitcher = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Navbar />;

  if (user.role === "admin") return <AdminNavbar />;

  return <Navbar />;
};

export default NavbarSwitcher;
