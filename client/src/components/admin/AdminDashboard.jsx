import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import API from "../../services/api";
import {
  deleteAdminJob,
  getAdminJobs,
  updateAdminJob,
} from "../../services/jobApi.jsx";
import StudentDrawer from "../student/StudentDrawer";
import "./AdminDashboard.css";

const toDateInput = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const getLogoUrl = (logo) => {
  if (!logo) return "";
  if (typeof logo === "string") return logo;
  return logo.secure_url || "";
};

const AdminDashboard = () => {
  const [stats, setStats] = useState({});
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [jobApplications, setJobApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [jobActionStatus, setJobActionStatus] = useState({
    type: "",
    message: "",
  });

  const [editingJobId, setEditingJobId] = useState("");
  const [editingJobDraft, setEditingJobDraft] = useState(null);
  const [editingLogoFile, setEditingLogoFile] = useState(null);
  const [editingLogoPreview, setEditingLogoPreview] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const refreshStudents = async (mode = "all") => {
    const endpoint =
      mode === "pending"
        ? "/admin/students/pending"
        : mode === "placed"
          ? "/admin/students/placed"
          : "/admin/students";
    const res = await API.get(endpoint);
    setStudents(res.data.students || []);
  };

  const refreshDashboard = async () => {
    const [statsRes, studentsRes, jobsRes] = await Promise.all([
      API.get("/admin/dashboard-stats"),
      API.get("/admin/students"),
      getAdminJobs(),
    ]);

    setStats(statsRes.data.stats || {});
    setJobApplications(statsRes.data.jobApplications || []);
    setStudents(studentsRes.data.students || []);
    setJobs(jobsRes.data.jobs || []);
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await refreshDashboard();
      } catch (err) {
        if (mounted) {
          console.error("Admin dashboard load error", err);
        }
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (editingLogoPreview && editingLogoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(editingLogoPreview);
      }
    };
  }, [editingLogoPreview]);

  const openEditJob = (job) => {
    setJobActionStatus({ type: "", message: "" });
    setEditingJobId(job._id);
    setEditingJobDraft({
      ...job,
      company: {
        name: job.company?.name || "",
        description: job.company?.description || "",
        website: job.company?.website || "",
        industry: job.company?.industry || "",
        logo: job.company?.logo || {},
      },
      employmentDetails: {
        employmentType: job.employmentDetails?.employmentType || "",
        workMode: job.employmentDetails?.workMode || "",
        location: job.employmentDetails?.location || "",
        department: job.employmentDetails?.department || "",
        openings: job.employmentDetails?.openings || 1,
      },
      roleDetails: {
        overview: job.roleDetails?.overview || "",
        responsibilities: job.roleDetails?.responsibilities || [],
        projects: job.roleDetails?.projects || "",
        techStack: job.roleDetails?.techStack || [],
        tools: job.roleDetails?.tools || [],
      },
      skills: {
        mustHave: job.skills?.mustHave || [],
        goodToHave: job.skills?.goodToHave || [],
        softSkills: job.skills?.softSkills || [],
      },
      compensation: {
        salaryRange: job.compensation?.salaryRange || "",
        stipend: job.compensation?.stipend || "",
        benefits: job.compensation?.benefits || [],
      },
      hiringProcess: {
        steps: job.hiringProcess?.steps || [],
        mode: job.hiringProcess?.mode || "",
        timeline: job.hiringProcess?.timeline || "",
      },
      timeline: {
        applyBy: toDateInput(job.timeline?.applyBy),
        lastDate: toDateInput(job.timeline?.lastDate),
        joiningDate: toDateInput(job.timeline?.joiningDate),
      },
    });
    setEditingLogoFile(null);
    setEditingLogoPreview(getLogoUrl(job.company?.logo));
  };

  const closeEditJob = () => {
    if (editingLogoPreview && editingLogoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(editingLogoPreview);
    }
    setEditingJobId("");
    setEditingJobDraft(null);
    setEditingLogoFile(null);
    setEditingLogoPreview("");
    setSavingEdit(false);
  };

  const setEditValue = (path, value) => {
    setEditingJobDraft((prev) => {
      const copy = structuredClone(prev);
      let cursor = copy;
      for (let i = 0; i < path.length - 1; i += 1) {
        cursor = cursor[path[i]];
      }
      cursor[path[path.length - 1]] = value;
      return copy;
    });
  };

  const handleUpdateJob = async (e) => {
    e.preventDefault();
    if (!editingJobId || !editingJobDraft) return;

    try {
      setSavingEdit(true);
      await updateAdminJob(editingJobId, editingJobDraft, editingLogoFile);
      await refreshDashboard();
      setJobActionStatus({
        type: "success",
        message: "Job updated successfully.",
      });
      closeEditJob();
    } catch (err) {
      setJobActionStatus({
        type: "error",
        message: err?.response?.data?.message || "Failed to update job.",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    const confirmed = window.confirm(
      "Delete this job post? This will also remove related applications.",
    );
    if (!confirmed) return;

    try {
      await deleteAdminJob(jobId);
      await refreshDashboard();
      setJobActionStatus({
        type: "success",
        message: "Job deleted successfully.",
      });
    } catch (err) {
      setJobActionStatus({
        type: "error",
        message: err?.response?.data?.message || "Failed to delete job.",
      });
    }
  };

  const sortedJobs = useMemo(
    () =>
      [...jobs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [jobs],
  );

  return (
    <div className="page-shell">
      <div className="page-inner admin-dashboard">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="dash-hero glass-card"
        >
          <div>
            <h1 className="section-title">Admin Control Deck</h1>
            <p className="muted">
              Manage jobs, shortlist students, and monitor applications with live
              insights.
            </p>
          </div>
        </motion.div>

        <div className="stat-grid">
          <button
            onClick={() => refreshStudents("all")}
            className="stat-card"
            type="button"
          >
            <span className="stat-label">Total Students</span>
            <h2>{stats.totalStudents || 0}</h2>
          </button>

          <button
            onClick={() => refreshStudents("pending")}
            className="stat-card"
            type="button"
          >
            <span className="stat-label">Pending Profiles</span>
            <h2>{stats.pendingProfiles || 0}</h2>
          </button>

          <button
            onClick={() => refreshStudents("placed")}
            className="stat-card"
            type="button"
          >
            <span className="stat-label">Placed Students</span>
            <h2>{stats.placedStudents || 0}</h2>
          </button>

          <div className="stat-card">
            <span className="stat-label">Jobs Posted</span>
            <h2>{stats.totalJobs || 0}</h2>
          </div>

          <div className="stat-card">
            <span className="stat-label">Applications</span>
            <h2>{stats.totalApplications || 0}</h2>
          </div>

          <div className="stat-card">
            <span className="stat-label">No Application Jobs</span>
            <h2>{stats.noApplicationJobs || 0}</h2>
          </div>
        </div>

        {jobActionStatus.message && (
          <p
            className={`dash-status ${
              jobActionStatus.type === "success" ? "ok" : "error"
            }`}
          >
            {jobActionStatus.message}
          </p>
        )}

        <section className="job-manage glass-card">
          <div className="section-head">
            <h2>Manage Job Posts</h2>
            <p className="muted">
              Edit, update, delete jobs, and keep company branding with logos.
            </p>
          </div>

          <div className="manage-grid">
            {sortedJobs.length === 0 && (
              <p className="muted">No job posted yet. Add your first job.</p>
            )}

            {sortedJobs.map((job) => (
              <article key={job._id} className="manage-card">
                <div className="manage-top">
                  <img
                    src={getLogoUrl(job.company?.logo) || "/default-avatar.png"}
                    alt={job.company?.name || "Company"}
                    className="manage-logo"
                  />
                  <div>
                    <p className="manage-title">{job.jobTitle}</p>
                    <p className="muted">{job.company?.name || "Company"}</p>
                  </div>
                </div>

                <div className="manage-metrics">
                  <span className="badge">Applied: {job.applicantsCount || 0}</span>
                  <span className="badge">Invited: {job.invitedStudentsCount || 0}</span>
                </div>

                <p className="muted text-sm">
                  Last Date:{" "}
                  {job.timeline?.lastDate
                    ? new Date(job.timeline.lastDate).toLocaleDateString("en-IN")
                    : "Not specified"}
                </p>

                <div className="manage-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => openEditJob(job)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleDeleteJob(job._id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="application-section glass-card">
          <div className="application-head">
            <h2>Job Application Insights</h2>
            <p className="muted">Track who applied and jobs that need attention.</p>
          </div>

          <div className="job-application-grid">
            {jobApplications.length === 0 && (
              <p className="muted">No jobs posted yet.</p>
            )}

            {jobApplications.map((job) => (
              <article key={job.jobId} className="job-application-card">
                <div className="job-card-top">
                  <div className="job-card-brand">
                    <img
                      src={job.companyLogo || "/default-avatar.png"}
                      alt={job.companyName}
                    />
                    <div>
                      <h3>{job.jobTitle}</h3>
                      <p className="muted">{job.companyName}</p>
                    </div>
                  </div>
                  <span className="badge">Applicants: {job.applicantsCount}</span>
                </div>

                <p className="muted text-sm">
                  Last Date:{" "}
                  {job.lastDate
                    ? new Date(job.lastDate).toLocaleDateString("en-IN")
                    : "Not specified"}
                </p>

                {job.applicantsCount === 0 ? (
                  <p className="muted">No one has applied yet.</p>
                ) : (
                  <div className="applicant-list">
                    {job.applicants.map((applicant) => (
                      <div key={applicant.applicationId} className="applicant-row">
                        <img
                          src={applicant.avatar || "/default-avatar.png"}
                          alt={applicant.fullname}
                        />
                        <div>
                          <p>{applicant.fullname}</p>
                          <p className="muted">{applicant.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="student-panel glass-card">
          <div className="section-head">
            <h2>Students</h2>
            <p className="muted">Click to open full details.</p>
          </div>
          <div className="student-list">
            {students.map((student) => (
              <button
                key={student._id}
                onClick={() => setSelectedStudent(student._id)}
                className="student-row"
                type="button"
              >
                <img
                  src={student.avatar?.secure_url || "/default-avatar.png"}
                  className="student-avatar"
                  alt={student.fullname}
                />
                <div>
                  <p className="student-name">{student.fullname}</p>
                  <p className="student-email">{student.email}</p>
                </div>
                {student.allowed && (
                  <span className="badge !ml-auto !bg-emerald-500/20 !border-emerald-400/50 !text-emerald-200">
                    Allowed
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      </div>

      {editingJobDraft && (
        <div className="edit-backdrop" onClick={closeEditJob}>
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="edit-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleUpdateJob}
          >
            <div className="section-head">
              <h2>Edit Job Post</h2>
            </div>

            <div className="edit-grid">
              <Field label="Job Title">
                <input
                  className="input"
                  value={editingJobDraft.jobTitle || ""}
                  onChange={(e) => setEditValue(["jobTitle"], e.target.value)}
                  required
                />
              </Field>
              <Field label="Company Name">
                <input
                  className="input"
                  value={editingJobDraft.company?.name || ""}
                  onChange={(e) => setEditValue(["company", "name"], e.target.value)}
                  required
                />
              </Field>
              <Field label="Website">
                <input
                  className="input"
                  value={editingJobDraft.company?.website || ""}
                  onChange={(e) =>
                    setEditValue(["company", "website"], e.target.value)
                  }
                />
              </Field>
              <Field label="Industry">
                <input
                  className="input"
                  value={editingJobDraft.company?.industry || ""}
                  onChange={(e) =>
                    setEditValue(["company", "industry"], e.target.value)
                  }
                />
              </Field>
              <Field label="Location">
                <input
                  className="input"
                  value={editingJobDraft.employmentDetails?.location || ""}
                  onChange={(e) =>
                    setEditValue(["employmentDetails", "location"], e.target.value)
                  }
                />
              </Field>
              <Field label="Salary Range">
                <input
                  className="input"
                  value={editingJobDraft.compensation?.salaryRange || ""}
                  onChange={(e) =>
                    setEditValue(["compensation", "salaryRange"], e.target.value)
                  }
                />
              </Field>
              <Field label="Last Date">
                <input
                  type="date"
                  className="input"
                  value={editingJobDraft.timeline?.lastDate || ""}
                  onChange={(e) => setEditValue(["timeline", "lastDate"], e.target.value)}
                  required
                />
              </Field>
              <Field label="Visibility">
                <select
                  className="select"
                  value={editingJobDraft.visibility || "EligibleStudents"}
                  onChange={(e) => setEditValue(["visibility"], e.target.value)}
                >
                  <option value="EligibleStudents">EligibleStudents</option>
                  <option value="Public">Public</option>
                </select>
              </Field>
            </div>

            <Field label="Job Description">
              <textarea
                className="textarea"
                rows={4}
                value={editingJobDraft.jobDescription || ""}
                onChange={(e) => setEditValue(["jobDescription"], e.target.value)}
              />
            </Field>

            <Field label="Company Logo">
              <input
                type="file"
                className="input"
                accept=".jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setEditingLogoFile(file);
                  setEditingLogoPreview((prev) => {
                    if (prev && prev.startsWith("blob:")) {
                      URL.revokeObjectURL(prev);
                    }
                    return file ? URL.createObjectURL(file) : "";
                  });
                }}
              />
              {editingLogoPreview && (
                <img
                  src={editingLogoPreview}
                  alt="logo preview"
                  className="edit-logo-preview"
                />
              )}
            </Field>

            <div className="edit-actions">
              <button type="button" className="btn-ghost" onClick={closeEditJob}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={savingEdit}>
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </motion.form>
        </div>
      )}

      {selectedStudent && (
        <StudentDrawer
          studentId={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};

const Field = ({ label, children }) => (
  <div className="field-block">
    <label className="input-label">{label}</label>
    {children}
  </div>
);

export default AdminDashboard;
