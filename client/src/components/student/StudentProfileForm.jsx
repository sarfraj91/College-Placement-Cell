import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import "./StudentProfileForm.css";

const CompleteProfile = () => {
  const navigate = useNavigate();

  /* ================= TEXT STATE ================= */
  const [form, setForm] = useState({
    fullname: "",
    phone: "",
    gender: "",
    dob: "",
    rollNo: "",
    branch: "",
    batch: "",
    cgpa: "",
    graduationYear: "",
    backlogs: "",
    placementStatus: "unplaced",

    tenthPercent: "",
    twelthPercent: "",
    cocubesScore: "",
    amcatScore: "",

    skills: "",
    linkedin: "",
    github: "",
    internships: "",
    projects: "",

    district: "",
    state: "",
    country: "",
    pincode: "",
  });

  /* ================= FILE STATE ================= */
  const [files, setFiles] = useState({
    tenth: null,
    twelth: null,
    semester: null,
    cocubes: null,
    amcat: null,
    resume: null,
  });

  const [previews, setPreviews] = useState({});
  const [otherCerts, setOtherCerts] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ================= HANDLERS ================= */
  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const setSingleFile = (key, file) => {
    if (!file) return;
    setFiles((p) => ({ ...p, [key]: file }));
    setPreviews((p) => ({ ...p, [key]: URL.createObjectURL(file) }));
  };

  /* ================= OTHER CERTIFICATES ================= */
  const addOtherCert = () =>
    setOtherCerts((p) => [...p, { title: "", file: null, preview: null }]);

  const updateOtherCert = (i, key, value) =>
    setOtherCerts((p) => {
      const copy = [...p];
      copy[i][key] = value;
      return copy;
    });

  const removeOtherCert = (i) =>
    setOtherCerts((p) => p.filter((_, idx) => idx !== i));

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const fd = new FormData();

      // TEXT DATA
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));

      // FIXED FILES
      if (files.tenth) fd.append("tenthMarksheet", files.tenth);
      if (files.twelth) fd.append("twelthMarksheet", files.twelth);
      if (files.semester) fd.append("semesterMarksheet", files.semester);
      if (files.cocubes) fd.append("cocubes", files.cocubes);
      if (files.amcat) fd.append("amcat", files.amcat);
      if (files.resume) fd.append("resume", files.resume);

      // MULTIPLE OTHER CERTS
      otherCerts.forEach((c) => {
        if (c.file && c.title) {
          fd.append("other", c.file);
          fd.append("otherTitle", c.title);
        }
      });

      await API.post("/users/saveInfo", fd);
      navigate("/student/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Profile update failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="page-shell">
      <form onSubmit={handleSubmit} className="page-inner profile-form">

        <h1 className="section-title form-title">
          Complete Placement Profile
        </h1>

        {error && (
          <p className="form-alert error">
            {error}
          </p>
        )}

        {/* PERSONAL & ACADEMIC */}
        <Section title="Personal & Academic">
          <Grid>
            <Input name="fullname" label="Full Name" onChange={handleChange} />
            <Input name="phone" label="Phone" onChange={handleChange} />
            <Input type="date" name="dob" label="Date of Birth" onChange={handleChange} />

            <Select
              name="gender"
              label="Gender"
              options={["Male", "Female", "Other"]}
              onChange={handleChange}
            />

            <Input name="rollNo" label="Roll Number" onChange={handleChange} />
            <Input name="branch" label="Branch" onChange={handleChange} />
            <Input name="batch" label="Batch" onChange={handleChange} />
            <Input name="cgpa" label="CGPA" onChange={handleChange} />
            <Input name="graduationYear" label="Graduation Year" onChange={handleChange} />
            <Input name="backlogs" label="Active Backlogs" onChange={handleChange} />
          </Grid>
        </Section>

        {/* PLACEMENT STATUS (🔥 FIXED & ADDED) */}
        <Section title="Placement Status">
          <div className="max-w-sm">
            <Select
              name="placementStatus"
              label="Current Placement Status"
              value={form.placementStatus}
              onChange={handleChange}
              options={[
                "placed",
                "unplaced",
                "higherStudies",
                "notInterested",
              ]}
            />
          </div>
        </Section>

        {/* SCORES */}
        <Section title="Academic Scores">
          <Grid>
            <Input name="tenthPercent" label="10th Percentage" onChange={handleChange} />
            <Input name="twelthPercent" label="Twelth Percentage" onChange={handleChange} />
            <Input name="cocubesScore" label="Cocubes Score" onChange={handleChange} />
            <Input name="amcatScore" label="AMCAT Score" onChange={handleChange} />
          </Grid>
        </Section>

        {/* SKILLS */}
        <Section title="Skills & Profiles">
          <Grid>
            <Input name="skills" label="Skills" onChange={handleChange} />
            <Input name="linkedin" label="LinkedIn" onChange={handleChange} />
            <Input name="github" label="GitHub" onChange={handleChange} />
            <Textarea name="projects" label="Projects" onChange={handleChange} />
            <Textarea name="internships" label="Internships / Training" onChange={handleChange} />
          </Grid>
        </Section>

        {/* ADDRESS */}
        <Section title="Address">
          <Grid>
            <Input name="district" label="District" onChange={handleChange} />
            <Input name="state" label="State" onChange={handleChange} />
            <Input name="country" label="Country" onChange={handleChange} />
            <Input name="pincode" label="Pincode" onChange={handleChange} />
          </Grid>
        </Section>

        {/* FIXED CERTIFICATES */}
        <Section title="Certificates">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <UploadCard label="10th Marksheet" onFile={(f) => setSingleFile("tenth", f)} preview={previews.tenth} />
            <UploadCard label="Twelth Marksheet" onFile={(f) => setSingleFile("twelth", f)} preview={previews.twelth} />
            <UploadCard label="Semester Marksheet" onFile={(f) => setSingleFile("semester", f)} preview={previews.semester} />
            <UploadCard label="Cocubes Certificate" onFile={(f) => setSingleFile("cocubes", f)} preview={previews.cocubes} />
            <UploadCard label="AMCAT Certificate" onFile={(f) => setSingleFile("amcat", f)} preview={previews.amcat} />
            <UploadCard label="Resume" onFile={(f) => setSingleFile("resume", f)} preview={previews.resume} />
          </div>
        </Section>

        {/* OTHER CERTIFICATES */}
        <Section title="Other Certificates (Multiple)">
          <div className="space-y-6">
            {otherCerts.map((c, i) => (
              <OtherCertCard
                key={i}
                cert={c}
                onTitle={(v) => updateOtherCert(i, "title", v)}
                onFile={(file) => {
                  updateOtherCert(i, "file", file);
                  updateOtherCert(i, "preview", URL.createObjectURL(file));
                }}
                onRemove={() => removeOtherCert(i)}
              />
            ))}

            <button
              type="button"
              onClick={addOtherCert}
              className="btn-secondary">
              + Add Certificate
            </button>
          </div>
        </Section>

        <button
          disabled={loading}
          className="btn-primary form-submit">
          {loading ? "Saving..." : "Save & Continue"}
        </button>
      </form>
    </div>
  );
};

/* ================= COMPONENTS ================= */

const UploadCard = ({ label, onFile, preview }) => {
  const ref = useRef();

  return (
    <div className="upload-card">
      <p className="font-medium">{label}</p>
      <button
        type="button"
        onClick={() => ref.current.click()}
        className="upload-btn">
        Choose File
      </button>

      <input
        ref={ref}
        type="file"
        hidden
        accept="image/*,.pdf,.doc,.docx"
        onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
      />

      {preview && (
        <img src={preview} className="upload-preview" />
      )}
    </div>
  );
};

const OtherCertCard = ({ cert, onTitle, onFile, onRemove }) => {
  const ref = useRef();

  return (
    <div className="other-cert-card">
      <Input label="Certificate Title" value={cert.title} onChange={(e) => onTitle(e.target.value)} />

      <div>
        <button
          type="button"
          onClick={() => ref.current.click()}
          className="upload-btn">
          Upload File
        </button>

        <input
          ref={ref}
          type="file"
          hidden
          accept="image/*,.pdf,.doc,.docx"
          onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
        />

        {cert.preview && (
          <img src={cert.preview} className="upload-preview" />
        )}
      </div>

      <button onClick={onRemove} className="remove-btn">
        ✕
      </button>
    </div>
  );
};

/* ================= SHARED ================= */

const Section = ({ title, children }) => (
  <section className="glass-card form-section">
    <h2 className="section-title form-section-title">{title}</h2>
    {children}
  </section>
);

const Grid = ({ children }) => (
  <div className="form-grid">{children}</div>
);

const Input = ({ label, ...props }) => (
  <div>
    <label className="input-label">{label}</label>
    <input
      {...props}
      className="input"
    />
  </div>
);

const Textarea = ({ label, ...props }) => (
  <div className="textarea-span">
    <label className="input-label">{label}</label>
    <textarea
      {...props}
      rows={3}
      className="textarea"
    />
  </div>
);

const Select = ({ label, options, ...props }) => (
  <div>
    <label className="input-label">{label}</label>
    <select
      {...props}
      className="select">
      <option value="">Select</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </div>
);

export default CompleteProfile;
