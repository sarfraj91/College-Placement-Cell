import { useEffect, useState } from "react";
import API from "../../services/api";
import "./StudentDrawer.css";

const StudentDrawer = ({ studentId, onClose }) => {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);


  const formatDOB = (dob) => {
  if (!dob) return "—";

  const date = new Date(dob);
  if (isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

  useEffect(() => {
    if (!studentId) return;

    let mounted = true;

    const fetchStudent = async () => {
      try {
        const res = await API.get(`/admin/students/${studentId}`);
        if (mounted) setStudent(res.data.student || res.data);
      } catch (err) {
        console.error("Failed to load student", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchStudent();
    return () => (mounted = false);
  }, [studentId]);

  if (loading) {
    return (
      <Drawer>
        <p className="text-slate-400">Loading student profile…</p>
      </Drawer>
    );
  }

  if (!student) return null;

  return (
    <Drawer onClose={onClose}>
      {/* ================= HEADER ================= */}
      <div className="drawer-header">
        <img
          src={student.avatar?.secure_url || "/default-avatar.png"}
          className="drawer-avatar"
          alt="avatar"
        />

        <div>
          <h2 className="drawer-name">
            {student.fullname}
          </h2>
          <p className="drawer-email">{student.email}</p>
          <p className="drawer-meta">
            {student.role} • {student.placementStatus}
          </p>
        </div>
      </div>

      {/* ================= PERSONAL ================= */}
      <Section title="Personal Information">
        <Info label="Phone" value={student.phone} />
        <Info label="Gender" value={student.gender} />
        <Info label="DOB" value={formatDOB(student.dob)} />

      </Section>

      {/* ================= ADDRESS ================= */}
      <Section title="Address">
        <Info label="District" value={student.address?.district} />
        <Info label="State" value={student.address?.state} />
        <Info label="Country" value={student.address?.country} />
        <Info label="Pincode" value={student.address?.pincode} />
      </Section>

      {/* ================= ACADEMIC ================= */}
      <Section title="Academic Details">
        <Info label="Roll No" value={student.rollNo} />
        <Info label="Branch" value={student.branch} />
        <Info label="Batch" value={student.batch} />
        <Info label="Graduation Year" value={student.graduationYear} />
        <Info label="CGPA" value={student.cgpa} />
        <Info label="Backlogs" value={student.backlogs} />
      </Section>

      {/* ================= SCORES ================= */}
      <Section title="Scores">
        <Info label="10th %" value={student.tenthPercent} />
        <Info label="Twelth %" value={student.twelthPercent ?? student.twelfthPercent} />
        <Info label="Cocubes Score" value={student.cocubesScore} />
        <Info label="AMCAT Score" value={student.amcatScore ?? student.mcatScore} />
      </Section>

      {/* ================= SKILLS ================= */}
      <Section title="Skills & Experience">
        <Info label="Skills" value={student.skills} />
        <Info label="Internships" value={student.internships} />
        <Info label="Projects" value={student.projects} />
        <Info label="LinkedIn" value={student.linkedin} />
        <Info label="GitHub" value={student.github} />
      </Section>

      {/* ================= CERTIFICATES ================= */}
      <Section title="Certificates">
        <div className="drawer-full space-y-2">

          {/* Single certificates */}
          {[
            "tenth",
            "twelth",
            "twelfth", // legacy
            "semester",
            "cocubes",
            "amcat",
            "mcat", // legacy
            "resume",
          ].map(
            (key) =>
              student.certificates?.[key]?.secure_url && (
                <CertLink
                  key={key}
                  title={key}
                  url={student.certificates[key].secure_url}
                  resourceType={student.certificates[key].resource_type}
                />
              )
          )}

          {/* Multiple OTHER certificates */}
          {Array.isArray(student.certificates?.other) &&
            student.certificates.other
              .filter(Boolean)
              .map((c, i) => (
                <CertLink
                  key={i}
                  title={c.title || "Other Certificate"}
                  url={c.secure_url}
                  resourceType={c.resource_type}
                />
              ))}

          {!student.certificates && (
            <p className="text-slate-500 text-sm">
              No certificates uploaded
            </p>
          )}
        </div>
      </Section>
    </Drawer>
  );
};

/* ================= UI HELPERS ================= */

const Drawer = ({ children, onClose }) => (
  <div
    className="drawer-backdrop"
    onClick={(e) => {
      if (e.target === e.currentTarget) {
        onClose?.();
      }
    }}
  >
    <div className="drawer-panel">
      {onClose && (
        <button onClick={onClose} className="drawer-close" aria-label="Close">
          ✕
        </button>
      )}
      {children}
    </div>
  </div>
);

const Section = ({ title, children }) => (
  <div className="drawer-section">
    <h3>{title}</h3>
    <div className="drawer-grid">{children}</div>
  </div>
);

const Info = ({ label, value }) => (
  <p className="drawer-info">
    <span>{label}:</span>
    <strong>{value ?? "—"}</strong>
  </p>
);

// ✅ Fix legacy Cloudinary PDF URLs only if resource_type is raw
const normalizeFileUrl = (url = "", resourceType = "") =>
  resourceType === "raw" && url.includes("/image/upload/")
    ? url.replace("/image/upload/", "/raw/upload/")
    : url;

const CertLink = ({ title, url, resourceType }) => (
  <a
    href={normalizeFileUrl(url, resourceType)}
    target="_blank"
    rel="noreferrer"
    className="drawer-link"
  >
    {title}
  </a>
);



export default StudentDrawer;
