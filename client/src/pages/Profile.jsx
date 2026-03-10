import { useEffect, useState } from "react";
import API from "../services/api";
import "./Profile.css";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [files, setFiles] = useState({});
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState("");

  /* ================= FETCH PROFILE ================= */
  useEffect(() => {
    API.get("/users/profile").then((res) => {
      const u = res.data.user;

      setUser(u);

      // ✅ FLATTEN address for form
      setForm({
        ...u,
        // ✅ Backward-compat for renamed fields
        twelthPercent: u.twelthPercent ?? u.twelfthPercent ?? "",
        amcatScore: u.amcatScore ?? u.mcatScore ?? "",
        district: u.address?.district || "",
        state: u.address?.state || "",
        country: u.address?.country || "",
        pincode: u.address?.pincode || "",
      });
    });
  }, []);

  if (!user) return <p className="profile-loading">Loading…</p>;

  /* ================= HANDLERS ================= */
  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleFile = (e) =>
    setFiles((p) => ({ ...p, [e.target.name]: e.target.files[0] }));

  /* ================= SAVE ================= */
  const saveProfile = async () => {
    try {
      const fd = new FormData();

      // ✅ rebuild address correctly
      const payload = {
        ...form,
        address: {
          district: form.district,
          state: form.state,
          country: form.country,
          pincode: form.pincode,
        },
      };

      // ❌ remove flattened fields
      delete payload.district;
      delete payload.state;
      delete payload.country;
      delete payload.pincode;

      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          fd.append(k, typeof v === "object" ? JSON.stringify(v) : v);
        }
      });

      Object.entries(files).forEach(([k, v]) => fd.append(k, v));

      await API.put("/users/updateProfile", fd);

      const refreshed = await API.get("/users/profile");
      setUser(refreshed.data.user);

      setEdit(false);
      setMsg("Profile updated successfully");
    } catch {
      setMsg("Update failed");
    }
  };

  /* ================= UI ================= */
  return (
    <div className="page-shell profile-page">
      <div className="page-inner profile-container">

        {/* ================= PROFILE HERO ================= */}
        <div className="profile-hero glass-card">
          <div className="profile-hero-main">
            <img
              src={user.avatar?.secure_url || "/avatar.png"}
              className="profile-avatar"
            />
            <div className="profile-hero-info">
              <h1 className="section-title">{user.fullname}</h1>
              <p className="muted">{user.email}</p>
              {edit && (
                <input
                  type="file"
                  name="avatar"
                  onChange={handleFile}
                  className="profile-upload"
                />
              )}
            </div>
          </div>

          {/* ================= QUICK STATS ================= */}
          <div className="profile-hero-stats">
            <div className="stat-chip">
              <span>Placement</span>
              <strong>{form.placementStatus || "—"}</strong>
            </div>
            <div className="stat-chip">
              <span>CGPA</span>
              <strong>{form.cgpa || "—"}</strong>
            </div>
            <div className="stat-chip">
              <span>Branch</span>
              <strong>{form.branch || "—"}</strong>
            </div>
          </div>
        </div>

        {msg && <p className="profile-status">{msg}</p>}

        {/* PERSONAL */}
        <Section title="Personal Information">
          <Grid>
            <Field label="Phone" name="phone" value={form.phone} edit={edit} onChange={handleChange} />
            <Field label="Gender" name="gender" value={form.gender} edit={edit} onChange={handleChange} />
            <Field label="DOB" type="date" name="dob" value={form.dob?.slice(0,10)} edit={edit} onChange={handleChange} />
          </Grid>
        </Section>

        {/* ADDRESS (✅ FIXED) */}
        <Section title="Address">
          <Grid>
            <Field label="District" name="district" value={form.district} edit={edit} onChange={handleChange} />
            <Field label="State" name="state" value={form.state} edit={edit} onChange={handleChange} />
            <Field label="Country" name="country" value={form.country} edit={edit} onChange={handleChange} />
            <Field label="Pincode" name="pincode" value={form.pincode} edit={edit} onChange={handleChange} />
          </Grid>
        </Section>

        {/* ACADEMIC */}
        <Section title="Academic Information">
          <Grid>
            <Field label="Branch" name="branch" value={form.branch} edit={edit} onChange={handleChange} />
            <Field label="Batch" name="batch" value={form.batch} edit={edit} onChange={handleChange} />
            <Field label="CGPA" name="cgpa" value={form.cgpa} edit={edit} onChange={handleChange} />
            <Field label="Backlogs" name="backlogs" value={form.backlogs} edit={edit} onChange={handleChange} />
          </Grid>
        </Section>

        {/* PLACEMENT */}
        <Section title="Placement & Scores">
          <Grid>
            <Field label="Placement Status" name="placementStatus" value={form.placementStatus} edit={edit} onChange={handleChange} />
            <Field label="Cocubes Score" name="cocubesScore" value={form.cocubesScore} edit={edit} onChange={handleChange} />
            <Field label="AMCAT Score" name="amcatScore" value={form.amcatScore} edit={edit} onChange={handleChange} />
          </Grid>
        </Section>

        {/* SKILLS */}
        <Section title="Skills & Links">
          <Grid>
            <Field label="Skills" name="skills" value={form.skills} edit={edit} onChange={handleChange} />
            <Field label="LinkedIn" name="linkedin" value={form.linkedin} edit={edit} onChange={handleChange} />
            <Field label="GitHub" name="github" value={form.github} edit={edit} onChange={handleChange} />
          </Grid>
        </Section>

        {/* CERTIFICATES (UNCHANGED ✅) */}
        <Section title="Certificates">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(user.certificates || {}).map(([key, cert]) =>
              Array.isArray(cert)
                ? cert.filter(Boolean).map((c, i) => (
                    <CertCard
                      key={i}
                      title={c.title}
                      url={c.secure_url}
                      resourceType={c.resource_type}
                      edit={edit}
                      inputName="other"
                      onFile={handleFile}
                    />
                  ))
                : cert?.secure_url && (
                    <CertCard
                      key={key}
                      title={key}
                      url={cert.secure_url}
                      resourceType={cert.resource_type}
                      edit={edit}
                      inputName={`${key}Marksheet`}
                      onFile={handleFile}
                    />
                  ),
            )}
          </div>
        </Section>

        {/* ACTION */}
        <div className="profile-actions">
          {!edit ? (
            <button onClick={() => setEdit(true)} className="btn-primary">
              Edit Profile
            </button>
          ) : (
            <button onClick={saveProfile} className="btn-primary">
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ================= UI HELPERS ================= */

// ✅ Fix legacy Cloudinary PDF URLs only if resource_type is raw
const normalizeFileUrl = (url = "", resourceType = "") =>
  resourceType === "raw" && url.includes("/image/upload/")
    ? url.replace("/image/upload/", "/raw/upload/")
    : url;

const Section = ({ title, children }) => (
  <section className="glass-card profile-section">
    <h2 className="section-title">{title}</h2>
    {children}
  </section>
);

const Grid = ({ children }) => (
  <div className="profile-grid">{children}</div>
);

const Field = ({ label, edit, value, name, onChange, type="text" }) => (
  <div>
    <p className="input-label">{label}</p>
    {edit ? (
      <input
        type={type}
        name={name}
        value={value || ""}
        onChange={onChange}
        className="input"
      />
    ) : (
      <p className="profile-value">{value || "—"}</p>
    )}
  </div>
);

const CertCard = ({ title, url, edit, inputName, onFile, resourceType }) => (
  <div className="profile-cert">
    <p className="profile-cert-title">{title}</p>
    <a
      href={normalizeFileUrl(url, resourceType)}
      target="_blank"
      className="profile-cert-link"
    >
      View / Download
    </a>
    {edit && (
      <input type="file" name={inputName} onChange={onFile} className="profile-upload" />
    )}
  </div>
);

export default Profile;
