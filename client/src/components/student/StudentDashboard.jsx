import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  applyToJob,
  getStudentAppliedJobs,
  getStudentJobs,
} from "../../services/jobApi.jsx";
import "./StudentDashboard.css";
import ChatBot from "./ChatBot.jsx";

const getLogoUrl = (logo) => {
  if (!logo) return "";
  if (typeof logo === "string") return logo;
  return logo.secure_url || "";
};

const StudentDashboard = () => {
  const [stats, setStats] = useState({
    availableJobs: 0,
    appliedJobs: 0,
  });
  const [jobs, setJobs] = useState([]);
  const [applyingJobId, setApplyingJobId] = useState("");
  const [actionStatus, setActionStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      try {
        const [jobsRes, appliedRes] = await Promise.all([
          getStudentJobs(),
          getStudentAppliedJobs(),
        ]);
        if (!mounted) return;
        const allJobs = jobsRes.data?.jobs || [];
        setJobs(allJobs);
        setStats({
          availableJobs: allJobs.length,
          appliedJobs: appliedRes.data?.applications?.length || 0,
        });
      } catch (error) {
        if (!mounted) return;
        setStats({ availableJobs: 0, appliedJobs: 0 });
        setJobs([]);
      }
    };

    loadStats();
    return () => {
      mounted = false;
    };
  }, []);

  const applyFromDashboard = async (jobId) => {
    try {
      setApplyingJobId(jobId);
      setActionStatus({ type: "", message: "" });
      await applyToJob(jobId);

      setJobs((prev) =>
        prev.map((job) =>
          job._id === jobId
            ? { ...job, hasApplied: true, canApply: false }
            : job,
        ),
      );
      setStats((prev) => ({ ...prev, appliedJobs: prev.appliedJobs + 1 }));
      setActionStatus({
        type: "success",
        message: "Applied successfully from dashboard.",
      });
    } catch (err) {
      setActionStatus({
        type: "error",
        message: err?.response?.data?.message || "Failed to apply.",
      });
    } finally {
      setApplyingJobId("");
    }
  };

  return (
    <div className="page-shell">
      <ChatBot />
      <div className="page-inner dashboard">
        <div className="dash-header">
          <h2 className="section-title">Student Dashboard</h2>
          <p className="muted">
            View all posted jobs and apply only if you are invited/allowed.
          </p>
        </div>

        <div className="cards">
          <div className="dash-card">
            <h3>Complete Profile</h3>
            <p className="muted">Update scores, documents, and certifications.</p>
            <Link className="btn-ghost" to="/student/complete-profile">
              Update Now
            </Link>
          </div>

          <div className="dash-card">
            <h3>View Profile</h3>
            <p className="muted">See how your profile looks to admins.</p>
            <Link className="btn-ghost" to="/student/view-profile">
              Open Profile
            </Link>
          </div>

          <div className="dash-card">
            <h3>Available Jobs</h3>
            <p className="muted">
              Total jobs posted by admin: <b>{stats.availableJobs}</b>
            </p>
            <Link className="btn-primary" to="/job">
              Browse Jobs
            </Link>
          </div>

          <div className="dash-card">
            <h3>Resume Intelligence</h3>
            <p className="muted">
              Analyze your uploaded resume, uncover missing skills, and open matched jobs from campus and external platforms.
            </p>
            <Link className="btn-primary" to="/student/resume-analyzer">
              Open Analyzer
            </Link>
          </div>

          <div className="dash-card">
            <h3>My Applications</h3>
            <p className="muted">
              Total applications submitted: <b>{stats.appliedJobs}</b>
            </p>
            <Link className="btn-ghost" to="/job">
              View Jobs
            </Link>
          </div>
        </div>

        <section className="available-jobs">
          <div className="available-jobs-head">
            <h3>Available Jobs</h3>
            <Link to="/job" className="btn-ghost">
              View All
            </Link>
          </div>

          {actionStatus.message && (
            <p className={`action-status ${actionStatus.type}`}>
              {actionStatus.message}
            </p>
          )}

          {jobs.length === 0 ? (
            <p className="muted">No jobs posted yet.</p>
          ) : (
            <div className="available-jobs-grid">
              {jobs.map((job) => (
                <article key={job._id} className="available-job-card">
                  <div className="job-brand">
                    <img
                      src={getLogoUrl(job.company?.logo) || "/default-avatar.png"}
                      alt={job.company?.name || "Company"}
                    />
                    <p className="muted">{job.company?.name || "Company"}</p>
                  </div>
                  <p className="job-title">{job.jobTitle}</p>
                  <div className="job-badges">
                    {job.hasApplied ? (
                      <span className="badge">Applied</span>
                    ) : job.applicationsClosed ? (
                      <span className="badge badge-warn">Closed</span>
                    ) : job.canApply ? (
                      <span className="badge">Can Apply</span>
                    ) : (
                      <span className="badge badge-warn">Invite Required</span>
                    )}
                  </div>
                  <div className="job-actions">
                    <Link className="btn-ghost" to={`/student/jobs/${job._id}`}>
                      View Job
                    </Link>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={job.hasApplied || !job.canApply || applyingJobId === job._id}
                      onClick={() => applyFromDashboard(job._id)}
                    >
                      {job.hasApplied
                        ? "Applied"
                        : applyingJobId === job._id
                          ? "Applying..."
                          : job.canApply
                            ? "Apply Now"
                            : "Not Allowed"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default StudentDashboard;
