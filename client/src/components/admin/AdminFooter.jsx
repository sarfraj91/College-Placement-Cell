import "./AdminFooter.css";

const AdminFooter = () => {
  return (
    <footer className="admin-footer">
      {/* ================= ADMIN FOOTER ================= */}
      <div className="admin-footer-inner">
        © {new Date().getFullYear()} Placement Cell Admin Panel
        <br />
        @MIT License | Developed by Team Placement Cell
      </div>
    </footer>
  );
};

export default AdminFooter;
