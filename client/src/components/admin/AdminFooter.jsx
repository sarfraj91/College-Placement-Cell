import "./AdminFooter.css";

const AdminFooter = () => {
  return (
    <footer className="admin-footer">
      {/* ================= ADMIN FOOTER ================= */}
      <div className="admin-footer-inner">
        © {new Date().getFullYear()} Placement Cell Admin Panel
        <br />
        Built with MERN + Tailwind
      </div>
    </footer>
  );
};

export default AdminFooter;
