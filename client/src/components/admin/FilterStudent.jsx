import { useEffect, useState } from "react";
import API from "../../services/api.jsx";
import { getAdminJobs } from "../../services/jobApi.jsx";
import "./FilterStudent.css";

const FilterStudents = () => {
  const [filters, setFilters] = useState({
    tenthMin: "",
    twelthMin: "",
    cgpaMin: "",
    backlogsMax: "",
    branch: "",
    batch: "",
    placementStatus: "",
  });

  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");

  const [emailForm, setEmailForm] = useState({
    subject: "",
    message: "",
  });
  const [emailStatus, setEmailStatus] = useState({
    sending: false,
    success: "",
    error: "",
  });

  useEffect(() => {
    let mounted = true;

    const loadJobs = async () => {
      try {
        const res = await getAdminJobs();
        if (!mounted) return;
        setJobs(res.data.jobs || []);
      } catch (error) {
        if (!mounted) return;
        setJobs([]);
      }
    };

    loadJobs();
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (e) =>
    setFilters((p) => ({ ...p, [e.target.name]: e.target.value }));

  const applyFilter = async () => {
    try {
      setLoading(true);

      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== ""),
      );

      const params = new URLSearchParams(cleanFilters);
      const res = await API.get(`/admin/students/filter?${params}`);

      setStudents(res.data.students || []);
      setSelected([]);
    } catch (err) {
      console.error("Filter failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e) =>
    setEmailForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const sendEmailToSelected = async () => {
    if (selected.length === 0) {
      setEmailStatus({
        sending: false,
        success: "",
        error: "Please select at least one student.",
      });
      return;
    }

    if (!selectedJobId) {
      setEmailStatus({
        sending: false,
        success: "",
        error: "Please select a job to invite students.",
      });
      return;
    }

    if (!emailForm.subject.trim() || !emailForm.message.trim()) {
      setEmailStatus({
        sending: false,
        success: "",
        error: "Subject and message are required.",
      });
      return;
    }

    try {
      setEmailStatus({ sending: true, success: "", error: "" });

      const payload = {
        studentIds: selected,
        subject: emailForm.subject.trim(),
        message: emailForm.message.trim(),
        jobId: selectedJobId,
      };

      const res = await API.post("/admin/students/email", payload);

      const failed = res.data?.failed || 0;
      const sent = res.data?.sent || 0;

      setEmailStatus({
        sending: false,
        success:
          failed > 0
            ? `Invitation sent to ${sent} students, failed for ${failed}.`
            : `Invitation sent to ${sent} students.`,
        error: "",
      });
    } catch (err) {
      setEmailStatus({
        sending: false,
        success: "",
        error: err?.response?.data?.message || "Failed to send invitation.",
      });
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const allSelected = students.length > 0 && selected.length === students.length;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(students.map((s) => s._id));
    }
  };

  return (
    <div className="page-shell">
      <div className="page-inner filter-page">
        <div className="filter-header">
          <h1 className="section-title">Filter Students</h1>
          <p className="muted">
            Shortlist students, choose a posted job, and send invitation emails.
          </p>
        </div>

        <div className="glass-card filter-panel">
          <Input label="10th % >=" name="tenthMin" onChange={handleChange} />
          <Input label="Twelth % >=" name="twelthMin" onChange={handleChange} />
          <Input label="CGPA >=" name="cgpaMin" onChange={handleChange} />
          <Input label="Backlogs <=" name="backlogsMax" onChange={handleChange} />
          <Input label="Branch" name="branch" onChange={handleChange} />
          <Input label="Batch" name="batch" onChange={handleChange} />

          <Select
            label="Placement Status"
            name="placementStatus"
            options={["placed", "unplaced", "higherStudies", "notInterested"]}
            onChange={handleChange}
          />

          <button onClick={applyFilter} className="btn-primary filter-btn">
            Apply Filter
          </button>
        </div>

        <div className="glass-card result-panel">
          <h2 className="result-title">Students Found: {students.length}</h2>

          <label className="select-all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
            />
            Select All
          </label>

          {loading ? (
            <p className="muted">Loading...</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Branch</th>
                  <th>CGPA</th>
                  <th>10th</th>
                  <th>Twelth</th>
                  <th>Backlogs</th>
                </tr>
              </thead>

              <tbody>
                {students.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(s._id)}
                        onChange={() => toggleSelect(s._id)}
                      />
                    </td>
                    <td>{s.fullname}</td>
                    <td>{s.branch}</td>
                    <td>{s.cgpa}</td>
                    <td>{s.tenthPercent}</td>
                    <td>{s.twelthPercent ?? s.twelfthPercent}</td>
                    <td>{s.backlogs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="glass-card email-panel">
          <h2 className="result-title">
            Invite Selected Students ({selected.length})
          </h2>

          <div>
            <label className="input-label">Select Job</label>
            <select
              className="select"
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
            >
              <option value="">Choose job</option>
              {jobs.map((job) => (
                <option key={job._id} value={job._id}>
                  {job.jobTitle} ({job.company?.name || "Company"})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Subject"
            name="subject"
            value={emailForm.subject}
            onChange={handleEmailChange}
          />

          <div>
            <label className="input-label">Message</label>
            <textarea
              name="message"
              rows="6"
              value={emailForm.message}
              onChange={handleEmailChange}
              className="textarea"
            />
          </div>

          {emailStatus.error && <p className="status error">{emailStatus.error}</p>}
          {emailStatus.success && (
            <p className="status success">{emailStatus.success}</p>
          )}

          <button
            onClick={sendEmailToSelected}
            disabled={emailStatus.sending}
            className="btn-secondary"
          >
            {emailStatus.sending ? "Sending..." : "Send Invitation"}
          </button>
        </div>

        <div className="filter-footer muted">
          Selected Students: {selected.length}
        </div>
      </div>
    </div>
  );
};

const Input = ({ label, ...props }) => (
  <div>
    <label className="input-label">{label}</label>
    <input {...props} className="input" />
  </div>
);

const Select = ({ label, options, ...props }) => (
  <div>
    <label className="input-label">{label}</label>
    <select {...props} className="select">
      <option value="">Any</option>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  </div>
);

export default FilterStudents;
