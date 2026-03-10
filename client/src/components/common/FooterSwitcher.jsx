import useAuth from "../../hooks/UseAuth";

import AdminFooter from "../admin/AdminFooter";
import Footer from "./Footer";

const FooterSwitcher = () => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Footer />; // no footer for guests (login/register)

  if (user.role === "admin") return <AdminFooter />;
  

  return <Footer />;
};

export default FooterSwitcher;
