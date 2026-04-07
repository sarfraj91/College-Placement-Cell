import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  applyToJob,
  getStudentApplicationStatus,
  getStudentJobDetails,
} from "../../services/jobApi.jsx";
import ChatBot from "./ChatBot.jsx";

const getLogoUrl = (logo) => {
  if (!logo) return "";
  if (typeof logo === "string") return logo;
  return logo.secure_url || "";
};

const formatDate = (value) => {
  if (!value) return "Not specified";
  return new Date(value).toLocaleDateString("en-IN");
};

const JobDetail = () => {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [applicationStatus, setApplicationStatus] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadJob = async () => {
      try {
        setLoading(true);
        const [jobRes, appStatusRes] = await Promise.allSettled([
          getStudentJobDetails(jobId),
          getStudentApplicationStatus(jobId),
        ]);

        if (!mounted) return;

        if (jobRes.status === "fulfilled") {
          setJob(jobRes.value.data.job);
        } else {
          setStatus({
            type: "error",
            message:
              jobRes.reason?.response?.data?.message ||
              "Unable to load job details.",
          });
        }

        if (appStatusRes.status === "fulfilled") {
          setApplicationStatus(appStatusRes.value.data.status || "applied");
        } else {
          setApplicationStatus("");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadJob();
    return () => {
      mounted = false;
    };
  }, [jobId]);

  const closed = useMemo(() => {
    if (job?.applicationsClosed !== undefined) {
      return Boolean(job.applicationsClosed);
    }
    if (!job?.timeline?.lastDate) return false;
    return new Date() > new Date(job.timeline.lastDate);
  }, [job]);

  const canApply = Boolean(job?.canApply) && !applicationStatus && !closed;

  const handleApply = async () => {
    setApplying(true);
    setStatus({ type: "", message: "" });

    try {
      const res = await applyToJob(jobId);
      setApplicationStatus(res.data?.application?.status || "applied");
      setStatus({ type: "success", message: "Applied successfully." });
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.response?.data?.message || "Failed to apply.",
      });
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="page-inner max-w-6xl">
          <div className="glass-card h-72 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page-shell">
        <div className="page-inner max-w-6xl">
          <div className="glass-card p-6">
            <p className="text-rose-200">{status.message || "Job not found."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <ChatBot selectedJobId={jobId} />
      <div className="page-inner max-w-6xl space-y-5">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 md:p-8"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-3">
              <img
                src={getLogoUrl(job.company?.logo) || "/default-avatar.png"}
                alt={job.company?.name || "Company"}
                className="h-14 w-14 rounded-xl border border-white/20 object-cover"
              />
              <div>
                <p className="text-sm muted">{job.company?.name || "Company"}</p>
                <h1 className="section-title mt-1">{job.jobTitle}</h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge
                label={
                  applicationStatus
                    ? `Status: ${applicationStatus}`
                    : closed
                      ? "Closed"
                      : job.canApply
                        ? "Can Apply"
                        : "Invite Required"
                }
                tone={
                  applicationStatus
                    ? "success"
                    : closed
                      ? "danger"
                      : job.canApply
                        ? "info"
                        : "warn"
                }
              />
              <StatusBadge
                label={job.employmentDetails?.workMode || "Work mode not set"}
                tone="neutral"
              />
            </div>
          </div>

          <p className="muted mt-4 whitespace-pre-wrap leading-relaxed">
            {job.jobDescription || "Description not provided"}
          </p>
        </motion.header>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-5">
            <InfoSection title="Company Overview">
              <InfoGrid
                items={[
                  { label: "Company", value: job.company?.name },
                  { label: "Industry", value: job.company?.industry },
                  { label: "Website", value: job.company?.website },
                  { label: "Location", value: job.employmentDetails?.location },
                ]}
              />
              <InfoBlock label="About Company" value={job.company?.description} />
            </InfoSection>

            <InfoSection title="Role and Skill Fit">
              <InfoBlock label="Role Overview" value={job.roleDetails?.overview} />
              <TagList
                label="Responsibilities"
                items={job.roleDetails?.responsibilities}
              />
              <TagList label="Must Have Skills" items={job.skills?.mustHave} />
              <TagList label="Good To Have Skills" items={job.skills?.goodToHave} />
              <TagList label="Soft Skills" items={job.skills?.softSkills} />
              <TagList label="Tech Stack" items={job.roleDetails?.techStack} />
              <TagList label="Tools" items={job.roleDetails?.tools} />
            </InfoSection>
          </div>

          <motion.aside
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5 h-fit lg:sticky lg:top-24 space-y-4"
          >
            <h2 className="text-lg font-semibold">Application Snapshot</h2>
            <InfoGrid
              compact
              items={[
                {
                  label: "Employment Type",
                  value: job.employmentDetails?.employmentType,
                },
                { label: "Salary", value: job.compensation?.salaryRange },
                { label: "Stipend", value: job.compensation?.stipend },
                { label: "Openings", value: job.employmentDetails?.openings },
                { label: "Apply By", value: formatDate(job.timeline?.applyBy) },
                { label: "Last Date", value: formatDate(job.timeline?.lastDate) },
                {
                  label: "Joining Date",
                  value: formatDate(job.timeline?.joiningDate),
                },
              ]}
            />
            <TagList label="Benefits" items={job.compensation?.benefits} />
            <TagList label="Hiring Steps" items={job.hiringProcess?.steps} />

            {status.message && (
              <p
                className={`rounded-xl border px-4 py-3 text-sm ${
                  status.type === "success"
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                    : "border-rose-400/50 bg-rose-500/15 text-rose-200"
                }`}
              >
                {status.message}
              </p>
            )}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              disabled={!canApply || applying}
              onClick={handleApply}
              className="btn-primary w-full py-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {applicationStatus
                ? `Already Applied (${applicationStatus})`
                : closed
                  ? "Applications Closed"
                  : !job.canApply
                    ? "Not Allowed To Apply"
                    : applying
                      ? "Applying..."
                      : "Apply for this Job"}
            </motion.button>

            <Link
              to={`/student/resume-analyzer?jobId=${job._id}`}
              className="btn-ghost block w-full text-center py-3"
            >
              Analyze Resume For This Role
            </Link>

            {!job.canApply && !closed && !applicationStatus && (
              <p className="muted text-xs">
                You can view this role, but only invited/allowed students can
                apply.
              </p>
            )}
          </motion.aside>
        </div>
      </div>
    </div>
  );
};

const InfoSection = ({ title, children }) => (
  <motion.section
    initial={{ opacity: 0, y: 8 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    className="glass-card p-6 md:p-7 space-y-4"
  >
    <h2 className="text-lg md:text-xl font-semibold">{title}</h2>
    {children}
  </motion.section>
);

const InfoGrid = ({ items = [], compact = false }) => (
  <div className={`grid gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
    {items.map((item) => (
      <div
        key={`${item.label}-${item.value}`}
        className="rounded-lg border border-white/12 bg-white/5 px-3 py-2"
      >
        <p className="muted text-[11px] uppercase tracking-wide">{item.label}</p>
        <p className={`${compact ? "text-sm" : "text-sm md:text-base"}`}>
          {item.value || "Not specified"}
        </p>
      </div>
    ))}
  </div>
);

const InfoBlock = ({ label, value }) => (
  <div>
    <p className="muted text-sm mb-1">{label}</p>
    <p className="text-sm whitespace-pre-wrap leading-relaxed">
      {value || "Not specified"}
    </p>
  </div>
);

const TagList = ({ label, items = [] }) => (
  <div>
    <p className="text-sm text-slate-300 mb-2">{label}</p>
    <div className="flex flex-wrap gap-2">
      {Array.isArray(items) && items.length > 0 ? (
        items.map((item) => (
          <span key={`${label}-${item}`} className="badge">
            {item}
          </span>
        ))
      ) : (
        <span className="muted text-sm">Not specified</span>
      )}
    </div>
  </div>
);

const StatusBadge = ({ label, tone = "neutral" }) => {
  const tones = {
    success: "border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
    danger: "border-rose-400/50 bg-rose-500/15 text-rose-200",
    info: "border-sky-400/50 bg-sky-500/15 text-sky-200",
    warn: "border-amber-400/50 bg-amber-500/15 text-amber-200",
    neutral: "border-white/25 bg-white/10 text-slate-100",
  };

  return <span className={`badge ${tones[tone]}`}>{label}</span>;
};

export default JobDetail;
