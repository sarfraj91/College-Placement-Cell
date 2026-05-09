import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Phone, Send, Star } from "lucide-react";
import {
  applyToJob,
  getStudentAppliedJobs,
  getStudentJobs,
} from "../../services/jobApi.jsx";
import { submitFeedback } from "../../services/feedbackApi.jsx";
import useAuth from "../../hooks/UseAuth.jsx";
import ParticleMesh from "../ui/ParticleMesh.jsx";
import ChatBot from "./ChatBot.jsx";
import "./StudentDashboard.css";

const FILTERS = [
  { value: "all", label: "All Roles" },
  { value: "ready", label: "Ready to Apply" },
  { value: "applied", label: "Applied" },
  { value: "invite", label: "Invite Only" },
  { value: "closed", label: "Closed" },
];

const getLogoUrl = (logo) => {
  if (!logo) return "";
  if (typeof logo === "string") return logo;
  return logo.secure_url || "";
};

const formatDate = (value) => {
  if (!value) return "Timeline soon";
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Timeline soon";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getStatusMeta = (job) => {
  if (job.hasApplied) {
    return { label: "Applied", className: "is-applied" };
  }

  if (job.applicationsClosed) {
    return { label: "Closed", className: "is-closed" };
  }

  if (job.canApply) {
    return { label: "Ready", className: "is-ready" };
  }

  return { label: "Invite Only", className: "is-invite" };
};

const getDeadlineMeta = (job) => {
  if (job.applicationsClosed) {
    return { label: "Applications closed", className: "is-closed" };
  }

  const lastDate = job.timeline?.lastDate;

  if (!lastDate) {
    return { label: "Open timeline", className: "is-neutral" };
  }

  const deadline = new Date(lastDate);

  if (Number.isNaN(deadline.getTime())) {
    return { label: "Open timeline", className: "is-neutral" };
  }

  const now = Date.now();
  const diffInDays = Math.ceil((deadline.getTime() - now) / 86400000);

  if (diffInDays <= 0) {
    return { label: "Closes today", className: "is-urgent" };
  }

  if (diffInDays === 1) {
    return { label: "1 day left", className: "is-urgent" };
  }

  if (diffInDays <= 7) {
    return { label: `${diffInDays} days left`, className: "is-soon" };
  }

  return {
    label: `Apply by ${formatDate(lastDate)}`,
    className: "is-neutral",
  };
};

const getJobPriority = (job) => {
  if (job.canApply && !job.hasApplied && !job.applicationsClosed) return 0;
  if (!job.canApply && !job.hasApplied && !job.applicationsClosed) return 1;
  if (job.hasApplied) return 2;
  return 3;
};

const getJobSortTime = (job) => {
  const source = job.timeline?.lastDate || job.createdAt || job.updatedAt;
  const parsed = new Date(source || "");
  return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
};

const sortJobs = (left, right) => {
  const priorityDiff = getJobPriority(left) - getJobPriority(right);

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const timelineDiff = getJobSortTime(left) - getJobSortTime(right);

  if (timelineDiff !== 0) {
    return timelineDiff;
  }

  return (left.jobTitle || "").localeCompare(right.jobTitle || "");
};

const handleCardPointerMove = (event) => {
  if (event.pointerType === "touch") return;

  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;
  const rotateY = (x - 0.5) * 16;
  const rotateX = (0.5 - y) * 16;

  card.style.setProperty("--rotate-x", `${rotateX.toFixed(2)}deg`);
  card.style.setProperty("--rotate-y", `${rotateY.toFixed(2)}deg`);
  card.style.setProperty("--glow-x", `${(x * 100).toFixed(2)}%`);
  card.style.setProperty("--glow-y", `${(y * 100).toFixed(2)}%`);
  card.style.setProperty("--glow-opacity", "1");
};

const resetCardPointer = (event) => {
  const card = event.currentTarget;
  card.style.setProperty("--rotate-x", "0deg");
  card.style.setProperty("--rotate-y", "0deg");
  card.style.setProperty("--glow-x", "50%");
  card.style.setProperty("--glow-y", "50%");
  card.style.setProperty("--glow-opacity", "0");
};

const StudentDashboard = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [appliedCount, setAppliedCount] = useState(0);
  const [applyingJobId, setApplyingJobId] = useState("");
  const [actionStatus, setActionStatus] = useState({ type: "", message: "" });
  const [reviewForm, setReviewForm] = useState({
    name: "",
    email: "",
    phone: "",
    rating: 0,
    message: "",
  });
  const [reviewStatus, setReviewStatus] = useState({ type: "", message: "" });
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    setReviewForm((current) => ({
      ...current,
      name: current.name || user?.fullname || "",
      email: current.email || user?.email || "",
      phone: current.phone || user?.phone || "",
    }));
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const [jobsRes, appliedRes] = await Promise.all([
          getStudentJobs(),
          getStudentAppliedJobs(),
        ]);

        if (!mounted) return;

        setJobs(jobsRes.data?.jobs || []);
        setAppliedCount(appliedRes.data?.applications?.length || 0);
      } catch (error) {
        if (!mounted) return;

        setJobs([]);
        setAppliedCount(0);
        setLoadError(
          error?.response?.data?.message ||
            "Unable to load the latest jobs right now.",
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const total = jobs.length;
    const ready = jobs.filter(
      (job) => job.canApply && !job.hasApplied && !job.applicationsClosed,
    ).length;
    const invite = jobs.filter(
      (job) => !job.canApply && !job.hasApplied && !job.applicationsClosed,
    ).length;
    const closed = jobs.filter((job) => job.applicationsClosed).length;
    const appliedInsideJobs = jobs.filter((job) => job.hasApplied).length;

    return {
      total,
      ready,
      invite,
      closed,
      applied: Math.max(appliedCount, appliedInsideJobs),
    };
  }, [appliedCount, jobs]);

  const filteredJobs = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return [...jobs]
      .filter((job) => {
        const location = job.employmentDetails?.location || "";
        const matchesQuery =
          !needle ||
          job.jobTitle?.toLowerCase().includes(needle) ||
          job.company?.name?.toLowerCase().includes(needle) ||
          location.toLowerCase().includes(needle);

        if (!matchesQuery) {
          return false;
        }

        switch (statusFilter) {
          case "ready":
            return job.canApply && !job.hasApplied && !job.applicationsClosed;
          case "applied":
            return job.hasApplied;
          case "invite":
            return !job.canApply && !job.hasApplied && !job.applicationsClosed;
          case "closed":
            return job.applicationsClosed;
          default:
            return true;
        }
      })
      .sort(sortJobs);
  }, [jobs, query, statusFilter]);

  const applyFromDashboard = async (jobId) => {
    try {
      setApplyingJobId(jobId);
      setActionStatus({ type: "", message: "" });
      await applyToJob(jobId);

      setJobs((currentJobs) =>
        currentJobs.map((job) =>
          job._id === jobId
            ? { ...job, hasApplied: true, canApply: false }
            : job,
        ),
      );
      setAppliedCount((currentCount) => currentCount + 1);
      setActionStatus({
        type: "success",
        message: "Application submitted successfully.",
      });
    } catch (error) {
      setActionStatus({
        type: "error",
        message: error?.response?.data?.message || "Failed to apply.",
      });
    } finally {
      setApplyingJobId("");
    }
  };

  const handleReviewInputChange = (event) => {
    const { name, value } = event.target;
    setReviewForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();

    if (!reviewForm.rating) {
      setReviewStatus({
        type: "error",
        message: "Please choose a rating before sending your review.",
      });
      return;
    }

    if (!reviewForm.message.trim()) {
      setReviewStatus({
        type: "error",
        message: "Please write a short review or feedback message.",
      });
      return;
    }

    try {
      setSubmittingReview(true);
      setReviewStatus({ type: "", message: "" });

      const response = await submitFeedback({
        ...reviewForm,
        channel: "web",
      });

      setReviewStatus({
        type: "success",
        message:
          response?.message ||
          "Your review has been saved and sent to the placement cell email.",
      });
      setReviewForm((current) => ({
        ...current,
        rating: 0,
        message: "",
      }));
    } catch (error) {
      setReviewStatus({
        type: "error",
        message:
          error?.response?.data?.message ||
          "We could not send your review right now.",
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="page-shell dashboard-shell">
      <div className="dashboard-backdrop" aria-hidden="true">
        <div className="dashboard-orb dashboard-orb-a" />
        <div className="dashboard-orb dashboard-orb-b" />
        <div className="dashboard-orb dashboard-orb-c" />
        <ParticleMesh className="dashboard-particle-mesh" />
      </div>

      <ChatBot />

      <div className="page-inner dashboard">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="dashboard-hub glass-card strong"
        >
          <div className="dashboard-hub-copy">
            <div className="dashboard-copy-main">
              <p className="dashboard-eyebrow">Student Dashboard</p>
              <h1 className="section-title">
                Jobs posted by admin:-
              </h1>
              {/* <p className="muted dashboard-intro">
                The old top hero and quick cards are removed. This view stays
                focused on live opportunities, fast scanning, and richer motion.
              </p> */}
            </div>

            <div className="dashboard-stats">
              <StatTile
                label="Live Roles"
                value={metrics.total}
                detail="Total jobs from admin"
              />
              <StatTile
                label="Ready"
                value={metrics.ready}
                detail="You can apply now"
              />
              <StatTile
                label="Applied"
                value={metrics.applied}
                detail="Already submitted"
              />
              <StatTile
                label="Invite Only"
                value={metrics.invite}
                detail="Needs approval first"
              />
            </div>
          </div>

          <div className="dashboard-toolbar">
            <label className="dashboard-search" htmlFor="dashboard-job-search">
              <span className="dashboard-search-label">Search jobs</span>
              <input
                id="dashboard-job-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Role, company, or location"
                className="input dashboard-search-input"
              />
            </label>

            <div className="dashboard-filters" aria-label="Job filters">
              {FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={`dashboard-filter ${
                    statusFilter === filter.value ? "is-active" : ""
                  }`}
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dashboard-subline">
            <p className="muted">
              Showing <strong>{filteredJobs.length}</strong> of{" "}
              <strong>{metrics.total}</strong> jobs.
            </p>
            <Link to="/job" className="btn-ghost dashboard-all-jobs-link">
              Open full jobs page
            </Link>
          </div>

          {actionStatus.message && (
            <p className={`action-status ${actionStatus.type}`}>
              {actionStatus.message}
            </p>
          )}

          {loading ? (
            <div className="available-jobs-grid">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="available-job-card is-skeleton">
                  <span className="skeleton-line skeleton-line-sm" />
                  <span className="skeleton-line skeleton-line-lg" />
                  <span className="skeleton-line skeleton-line-md" />
                  <div className="job-meta-grid">
                    <span className="skeleton-block" />
                    <span className="skeleton-block" />
                    <span className="skeleton-block" />
                    <span className="skeleton-block" />
                  </div>
                  <span className="skeleton-line skeleton-line-md" />
                  <span className="skeleton-line skeleton-line-sm" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="dashboard-empty">
              <p className="dashboard-empty-title">Unable to load jobs</p>
              <p className="muted">{loadError}</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="dashboard-empty">
              <p className="dashboard-empty-title">
                No jobs match your current filter
              </p>
              <p className="muted">
                Try a different search term or switch back to the full jobs view.
              </p>
              <button
                type="button"
                className="btn-ghost dashboard-clear-btn"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="available-jobs-grid">
              {filteredJobs.map((job, index) => {
                const status = getStatusMeta(job);
                const deadline = getDeadlineMeta(job);
                const topSkills = Array.isArray(job.skills?.mustHave)
                  ? job.skills.mustHave.slice(0, 4)
                  : [];

                return (
                  <motion.article
                    key={job._id}
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.04 }}
                    className="available-job-card"
                    onPointerMove={handleCardPointerMove}
                    onPointerLeave={resetCardPointer}
                  >
                    <div className="job-card-top">
                      <div className="job-brand">
                        <img
                          src={
                            getLogoUrl(job.company?.logo) || "/default-avatar.png"
                          }
                          alt={job.company?.name || "Company"}
                        />
                        <div>
                          <p className="job-company">
                            {job.company?.name || "Company"}
                          </p>
                          <p className="muted job-location">
                            {job.employmentDetails?.location || "Location soon"}
                          </p>
                        </div>
                      </div>

                      <span className={`job-state-pill ${status.className}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="job-copy">
                      <p className="job-kicker">
                        {job.employmentDetails?.employmentType || "Opportunity"}
                      </p>
                      <h2 className="job-title">{job.jobTitle}</h2>
                      {/* <p className="job-description">
                        {job.jobDescription || "Description not available."}
                      </p> */}
                    </div>

                    <div className="job-meta-grid">
                      {/* <MetaTile
                        label="Package"
                        value={job.compensation?.salaryRange || "As per company"}
                      />
                      <MetaTile
                        label="Mode"
                        value={job.employmentDetails?.workMode || "Not specified"}
                      />
                      <MetaTile
                        label="Location"
                        value={
                          job.employmentDetails?.location || "Location not specified"
                        }
                      />
                      <MetaTile
                        label="Deadline"
                        value={formatDate(job.timeline?.lastDate)}
                      /> */}
                    </div>

                    <div className="job-card-footer">
                      <div className="job-card-insights">
                        <span className={`deadline-pill ${deadline.className}`}>
                          {deadline.label}
                        </span>

                        <div className="skill-cloud">
                          {topSkills.length > 0 ? (
                            topSkills.map((skill) => (
                              <span key={`${job._id}-${skill}`} className="badge">
                                {skill}
                              </span>
                            ))
                          ) : (
                            <span className="muted skill-fallback">
                              Skills will appear here when admins add them.
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="job-actions">
                        <Link className="btn-ghost" to={`/student/jobs/${job._id}`}>
                          View Job
                        </Link>
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={
                            job.hasApplied ||
                            !job.canApply ||
                            applyingJobId === job._id
                          }
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

                      <Link
                        className="job-assist-link"
                        to={`/student/resume-analyzer?jobId=${job._id}`}
                      >
                        Check resume fit for this role
                      </Link>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="dashboard-review-card glass-card strong"
        >
          <div className="dashboard-review-copy">
            <p className="dashboard-eyebrow">Rate Your Experience</p>
            <h2 className="section-title dashboard-review-title">
              Reviews and feedback
            </h2>
            <p className="muted dashboard-review-text">
              Share what is working well and what should improve. Your review is
              stored in the database and also sent directly to the placement
              support email.
            </p>
          </div>

          <form className="dashboard-review-form" onSubmit={handleReviewSubmit}>
            <div className="dashboard-review-grid">
              <label className="dashboard-review-field">
                <span>Name</span>
                <input
                  className="input"
                  name="name"
                  value={reviewForm.name}
                  onChange={handleReviewInputChange}
                  placeholder="Your full name"
                />
              </label>

              <label className="dashboard-review-field">
                <span>Email</span>
                <div className="dashboard-review-input-wrap">
                  <Mail size={16} />
                  <input
                    className="input"
                    name="email"
                    type="email"
                    value={reviewForm.email}
                    onChange={handleReviewInputChange}
                    placeholder="yourname@example.com"
                  />
                </div>
              </label>

              <label className="dashboard-review-field">
                <span>Phone</span>
                <div className="dashboard-review-input-wrap">
                  <Phone size={16} />
                  <input
                    className="input"
                    name="phone"
                    value={reviewForm.phone}
                    onChange={handleReviewInputChange}
                    placeholder="Optional phone number"
                  />
                </div>
              </label>
            </div>

            <div className="dashboard-review-rating">
              <div>
                <p className="dashboard-review-label">Your rating</p>
                <p className="dashboard-review-hint">
                  Tap a star to rate your dashboard experience.
                </p>
              </div>

              <div
                className="dashboard-review-stars"
                role="radiogroup"
                aria-label="Rating"
              >
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = value <= reviewForm.rating;

                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      className={`dashboard-star-button ${
                        active ? "is-active" : ""
                      }`}
                      aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                      aria-checked={reviewForm.rating === value}
                      onClick={() =>
                        setReviewForm((current) => ({
                          ...current,
                          rating: value,
                        }))
                      }
                    >
                      <Star size={20} fill={active ? "currentColor" : "none"} />
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="dashboard-review-field">
              <span>Your review</span>
              <textarea
                className="input dashboard-review-textarea"
                name="message"
                rows="5"
                value={reviewForm.message}
                onChange={handleReviewInputChange}
                placeholder="Tell us what you liked, what felt confusing, or what feature you want next."
              />
            </label>

            {reviewStatus.message && (
              <p className={`action-status ${reviewStatus.type}`}>
                {reviewStatus.message}
              </p>
            )}

            <div className="dashboard-review-actions">
              <button
                type="submit"
                className="btn-primary dashboard-review-submit"
                disabled={submittingReview}
              >
                <Send size={16} />
                {submittingReview ? "Sending..." : "Send review"}
              </button>
            </div>
          </form>
        </motion.section>
      </div>
    </div>
  );
};

const StatTile = ({ label, value, detail }) => (
  <div className="dashboard-stat">
    <p className="dashboard-stat-label">{label}</p>
    <p className="dashboard-stat-value">{value}</p>
    <p className="dashboard-stat-detail">{detail}</p>
  </div>
);

const MetaTile = ({ label, value }) => (
  <div className="job-meta-tile">
    <p className="job-meta-label">{label}</p>
    <p className="job-meta-value">{value}</p>
  </div>
);

export default StudentDashboard;
