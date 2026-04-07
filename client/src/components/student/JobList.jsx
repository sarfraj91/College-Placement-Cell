import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getStudentJobs } from "../../services/jobApi.jsx";

const getLogoUrl = (logo) => {
  if (!logo) return "";
  if (typeof logo === "string") return logo;
  return logo.secure_url || "";
};

const formatDate = (value) => {
  if (!value) return "Not specified";
  return new Date(value).toLocaleDateString("en-IN");
};

const statusFromJob = (job) => {
  if (job.hasApplied) {
    return {
      label: "Applied",
      classes:
        "border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
    };
  }
  if (job.applicationsClosed) {
    return {
      label: "Closed",
      classes: "border-rose-400/50 bg-rose-500/15 text-rose-200",
    };
  }
  if (job.canApply) {
    return {
      label: "Can Apply",
      classes: "border-sky-400/50 bg-sky-500/15 text-sky-200",
    };
  }
  return {
    label: "Invite Required",
    classes: "border-amber-400/50 bg-amber-500/15 text-amber-200",
  };
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
      <div className="page-inner max-w-7xl space-y-6">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 md:p-8 space-y-4"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="section-title">Explore Opportunities</h1>
              <p className="muted mt-2">
                Find roles, track your application status, and apply to invited
                jobs before deadlines.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatChip label="Total" value={stats.total} />
              <StatChip label="Can Apply" value={stats.canApply} />
              <StatChip label="Applied" value={stats.applied} />
              <StatChip label="Closed" value={stats.closed} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by role, company, or location..."
              className="input"
            />
            <div className="flex flex-wrap gap-2">
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((key) => (
              <div key={key} className="glass-card h-56 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="rounded-xl border border-rose-400/50 bg-rose-500/15 px-4 py-3 text-rose-200">
            {error}
          </p>
        )}

        {!loading && !error && filteredJobs.length === 0 && (
          <div className="glass-card p-6 md:p-8">
            <p className="text-lg">No jobs found for the selected filters.</p>
          </div>
        )}

        {!loading && !error && filteredJobs.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredJobs.map((job, idx) => {
              const status = statusFromJob(job);
              const topSkills = Array.isArray(job.skills?.mustHave)
                ? job.skills.mustHave.slice(0, 4)
                : [];

              return (
                <motion.article
                  key={job._id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="glass-card p-5 flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={getLogoUrl(job.company?.logo) || "/default-avatar.png"}
                        alt={job.company?.name || "Company"}
                        className="h-11 w-11 rounded-lg border border-white/20 object-cover"
                      />
                      <div>
                        <p className="text-sm font-semibold">
                          {job.company?.name || "Company"}
                        </p>
                        <p className="muted text-xs">
                          {job.employmentDetails?.location || "Location not specified"}
                        </p>
                      </div>
                    </div>
                    <span className={`badge ${status.classes}`}>{status.label}</span>
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold leading-snug">{job.jobTitle}</h2>
                    <p className="muted text-sm line-clamp-2">
                      {job.jobDescription || "Description not available"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <MetaTile
                      label="Job Type"
                      value={job.employmentDetails?.employmentType || "Not specified"}
                    />
                    <MetaTile
                      label="Salary"
                      value={job.compensation?.salaryRange || "As per company"}
                    />
                    <MetaTile label="Deadline" value={formatDate(job.timeline?.lastDate)} />
                    <MetaTile
                      label="Work Mode"
                      value={job.employmentDetails?.workMode || "Not specified"}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {topSkills.length > 0 ? (
                      topSkills.map((skill) => (
                        <span key={`${job._id}-${skill}`} className="badge">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="muted text-xs">Skills not specified</span>
                    )}
                  </div>

                  <div className="mt-auto grid gap-2">
                    <Link
                      to={`/student/jobs/${job._id}`}
                      className="btn-primary w-full justify-center"
                    >
                      View Details
                    </Link>
                    <Link
                      to={`/student/resume-analyzer?jobId=${job._id}`}
                      className="btn-ghost w-full justify-center"
                    >
                      Analyze Resume
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
  <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center">
    <p className="muted text-[11px] uppercase tracking-wide">{label}</p>
    <p className="text-base font-semibold">{value}</p>
  </div>
);

const FilterButton = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
      active
        ? "border-cyan-300/55 bg-cyan-400/20 text-cyan-100"
        : "border-white/15 bg-white/5 text-slate-300 hover:border-cyan-300/35"
    }`}
  >
    {label}
  </button>
);

const MetaTile = ({ label, value }) => (
  <div className="rounded-lg border border-white/10 bg-white/5 p-2">
    <p className="muted text-[10px] uppercase tracking-wide">{label}</p>
    <p className="text-xs">{value}</p>
  </div>
);

export default JobList;
