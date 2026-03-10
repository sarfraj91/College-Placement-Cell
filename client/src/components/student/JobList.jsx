import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getStudentJobs } from "../../services/jobApi.jsx";

const getLogoUrl = (logo) => {
  if (!logo) return "";
  if (typeof logo === "string") return logo;
  return logo.secure_url || "";
};

const JobList = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div className="page-shell">
      <div className="page-inner max-w-6xl space-y-6">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 md:p-8"
        >
          <h1 className="section-title">Available Jobs</h1>
          <p className="muted mt-2">
            All jobs posted by admin are visible here. Only invited students can
            apply.
          </p>
        </motion.header>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((key) => (
              <div key={key} className="glass-card h-52 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="rounded-xl border border-rose-400/50 bg-rose-500/15 px-4 py-3 text-rose-200">
            {error}
          </p>
        )}

        {!loading && !error && jobs.length === 0 && (
          <div className="glass-card p-6 md:p-8">
            <p className="text-lg">No jobs posted yet.</p>
          </div>
        )}

        {!loading && !error && jobs.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job, idx) => (
              <motion.article
                key={job._id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="glass-card p-5 flex flex-col gap-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={getLogoUrl(job.company?.logo) || "/default-avatar.png"}
                      alt={job.company?.name || "Company"}
                      className="h-8 w-8 rounded-md border border-white/20 object-cover"
                    />
                    <span className="badge">{job.company?.name || "Company"}</span>
                  </div>
                  {job.hasApplied ? (
                    <span className="badge !bg-emerald-500/20 !border-emerald-400/50 !text-emerald-200">
                      Applied
                    </span>
                  ) : job.applicationsClosed ? (
                    <span className="badge !bg-rose-500/20 !border-rose-400/50 !text-rose-200">
                      Closed
                    </span>
                  ) : job.canApply ? (
                    <span className="badge !bg-sky-500/20 !border-sky-400/50 !text-sky-200">
                      Can Apply
                    </span>
                  ) : (
                    <span className="badge !bg-amber-500/20 !border-amber-400/50 !text-amber-200">
                      Invite Required
                    </span>
                  )}
                </div>

                <div>
                  <h2 className="text-lg font-semibold">
                    {job.jobTitle}
                  </h2>
                  <p className="muted text-sm mt-1">
                    {job.employmentDetails?.location || "Location not specified"}
                  </p>
                </div>

                <div className="text-sm text-slate-200/90 space-y-1">
                  <p>
                    Salary:{" "}
                    <span className="muted">
                      {job.compensation?.salaryRange || "As per company norms"}
                    </span>
                  </p>
                  <p>
                    Last Date:{" "}
                    <span className="muted">
                      {job.timeline?.lastDate
                        ? new Date(job.timeline.lastDate).toLocaleDateString("en-IN")
                        : "Not specified"}
                    </span>
                  </p>
                </div>

                <Link
                  to={`/student/jobs/${job._id}`}
                  className="btn-primary mt-auto w-full text-center"
                >
                  View Details
                </Link>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobList;
