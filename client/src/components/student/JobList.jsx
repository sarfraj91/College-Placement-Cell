import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getStudentJobs } from "../../services/jobApi.jsx";
import "./JobList.css";

const getLogoUrl = (logo) => {
  if (!logo) return "";
  if (typeof logo === "string") return logo;
  return logo.secure_url || "";
};

const formatDate = (value) => {
  if (!value) return "Not specified";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not specified";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const statusFromJob = (job) => {
  if (job.hasApplied) {
    return {
      label: "Applied",
      className: "job-list-card__status--applied",
    };
  }

  if (job.applicationsClosed) {
    return {
      label: "Closed",
      className: "job-list-card__status--closed",
    };
  }

  if (job.canApply) {
    return {
      label: "Can Apply",
      className: "job-list-card__status--ready",
    };
  }

  return {
    label: "Invite Required",
    className: "job-list-card__status--invite",
  };
};

const handleCardPointerMove = (event) => {
  if (event.pointerType === "touch") return;

  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;
  const rotateY = (x - 0.5) * 14;
  const rotateX = (0.5 - y) * 14;

  card.style.setProperty("--job-card-rotate-x", `${rotateX.toFixed(2)}deg`);
  card.style.setProperty("--job-card-rotate-y", `${rotateY.toFixed(2)}deg`);
  card.style.setProperty("--job-card-glow-x", `${(x * 100).toFixed(2)}%`);
  card.style.setProperty("--job-card-glow-y", `${(y * 100).toFixed(2)}%`);
  card.style.setProperty("--job-card-glow-opacity", "1");
};

const resetCardPointer = (event) => {
  const card = event.currentTarget;

  card.style.setProperty("--job-card-rotate-x", "0deg");
  card.style.setProperty("--job-card-rotate-y", "0deg");
  card.style.setProperty("--job-card-glow-x", "50%");
  card.style.setProperty("--job-card-glow-y", "50%");
  card.style.setProperty("--job-card-glow-opacity", "0");
};

const JobList = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let isMounted = true;

    const loadJobs = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await getStudentJobs();
        if (!isMounted) return;
        setJobs(res.data.jobs || []);
      } catch (err) {
        if (!isMounted) return;
        setError(err?.response?.data?.message || "Failed to load jobs.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadJobs();
    return () => {
      isMounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = jobs.length;
    const canApply = jobs.filter((job) => job.canApply).length;
    const applied = jobs.filter((job) => job.hasApplied).length;
    const closed = jobs.filter((job) => job.applicationsClosed).length;
    return { total, canApply, applied, closed };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return jobs.filter((job) => {
      const passesQuery =
        !needle ||
        job.jobTitle?.toLowerCase().includes(needle) ||
        job.company?.name?.toLowerCase().includes(needle) ||
        job.employmentDetails?.location?.toLowerCase().includes(needle);

      if (!passesQuery) return false;

      switch (statusFilter) {
        case "canApply":
          return job.canApply;
        case "applied":
          return job.hasApplied;
        case "closed":
          return job.applicationsClosed;
        case "invite":
          return !job.canApply && !job.hasApplied && !job.applicationsClosed;
        default:
          return true;
      }
    });
  }, [jobs, query, statusFilter]);

  return (
    <div className="page-shell">
      <div className="page-inner job-list-page">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card job-list-header"
        >
          <div className="job-list-header__top">
            <div>
              <h1 className="section-title">Explore Opportunities</h1>
              <p className="muted job-list-header__copy">
                Find roles, track your application status, and apply to invited
                jobs before deadlines.
              </p>
            </div>

            <div className="job-list-stats">
              <StatChip label="Total" value={stats.total} />
              <StatChip label="Can Apply" value={stats.canApply} />
              <StatChip label="Applied" value={stats.applied} />
              <StatChip label="Closed" value={stats.closed} />
            </div>
          </div>

          <div className="job-list-header__controls">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by role, company, or location..."
              className="input job-list-search"
            />
            <div className="job-list-filters">
              <FilterButton
                active={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
                label="All"
              />
              <FilterButton
                active={statusFilter === "canApply"}
                onClick={() => setStatusFilter("canApply")}
                label="Can Apply"
              />
              <FilterButton
                active={statusFilter === "applied"}
                onClick={() => setStatusFilter("applied")}
                label="Applied"
              />
              <FilterButton
                active={statusFilter === "closed"}
                onClick={() => setStatusFilter("closed")}
                label="Closed"
              />
              <FilterButton
                active={statusFilter === "invite"}
                onClick={() => setStatusFilter("invite")}
                label="Invite Required"
              />
            </div>
          </div>
        </motion.header>

        {loading && (
          <div className="job-list-grid">
            {[1, 2, 3, 4, 5, 6].map((key) => (
              <div key={key} className="job-list-card job-list-card--skeleton">
                <span className="job-skeleton job-skeleton--brand" />
                <span className="job-skeleton job-skeleton--title" />
                <div className="job-list-card__meta-grid">
                  <span className="job-skeleton job-skeleton--tile" />
                  <span className="job-skeleton job-skeleton--tile" />
                  <span className="job-skeleton job-skeleton--tile" />
                  <span className="job-skeleton job-skeleton--tile" />
                </div>
                <span className="job-skeleton job-skeleton--skills" />
                <span className="job-skeleton job-skeleton--actions" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="job-list-message job-list-message--error">{error}</p>
        )}

        {!loading && !error && filteredJobs.length === 0 && (
          <div className="glass-card job-list-empty">
            <p className="job-list-empty__title">
              No jobs found for the selected filters.
            </p>
          </div>
        )}

        {!loading && !error && filteredJobs.length > 0 && (
          <div className="job-list-grid">
            {filteredJobs.map((job, idx) => {
              const status = statusFromJob(job);
              const topSkills = Array.isArray(job.skills?.mustHave)
                ? job.skills.mustHave.slice(0, 3)
                : [];

              return (
                <motion.article
                  key={job._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="job-list-card"
                  onPointerMove={handleCardPointerMove}
                  onPointerLeave={resetCardPointer}
                >
                  <div className="job-list-card__head">
                    <div className="job-list-card__brand">
                      <img
                        src={getLogoUrl(job.company?.logo) || "/default-avatar.png"}
                        alt={job.company?.name || "Company"}
                        className="job-list-card__logo"
                      />
                      <div>
                        <p className="job-list-card__company">
                          {job.company?.name || "Company"}
                        </p>
                        <p className="job-list-card__location">
                          {job.employmentDetails?.location || "Location not specified"}
                        </p>
                      </div>
                    </div>
                    <span className={`job-list-card__status ${status.className}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="job-list-card__title-block">
                    <p className="job-list-card__kicker">
                      {job.employmentDetails?.employmentType || "Opportunity"}
                    </p>
                    <h2 className="job-list-card__title">{job.jobTitle}</h2>
                  </div>

                  <div className="job-list-card__meta-grid">
                    <MetaTile
                      label="Salary"
                      value={job.compensation?.salaryRange || "As per company"}
                    />
                    <MetaTile
                      label="Deadline"
                      value={formatDate(job.timeline?.lastDate)}
                    />
                    <MetaTile
                      label="Work Mode"
                      value={job.employmentDetails?.workMode || "Not specified"}
                    />
                    <MetaTile
                      label="Location"
                      value={job.employmentDetails?.location || "Not specified"}
                    />
                  </div>

                  <div className="job-list-card__skills">
                    {topSkills.length > 0 ? (
                      topSkills.map((skill) => (
                        <span key={`${job._id}-${skill}`} className="job-skill-chip">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="job-list-card__skills-empty">
                        Skills not specified
                      </span>
                    )}
                  </div>

                  <div className="job-list-card__actions">
                    <Link
                      to={`/student/jobs/${job._id}`}
                      className="job-card-link job-card-link--primary"
                    >
                      Details
                    </Link>
                    <Link
                      to={`/student/resume-analyzer?jobId=${job._id}`}
                      className="job-card-link"
                    >
                      Resume Fit
                    </Link>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const StatChip = ({ label, value }) => (
  <div className="job-stat-chip">
    <p className="job-stat-chip__label">{label}</p>
    <p className="job-stat-chip__value">{value}</p>
  </div>
);

const FilterButton = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`job-filter-button ${active ? "is-active" : ""}`}
  >
    {label}
  </button>
);

const MetaTile = ({ label, value }) => (
  <div className="job-meta-tile">
    <p className="job-meta-tile__label">{label}</p>
    <p className="job-meta-tile__value">{value}</p>
  </div>
);

export default JobList;
