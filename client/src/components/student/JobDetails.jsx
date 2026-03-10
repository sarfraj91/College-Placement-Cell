import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  applyToJob,
  getStudentApplicationStatus,
  getStudentJobDetails,
} from "../../services/jobApi.jsx";

const getLogoUrl = (logo) => {
  if (!logo) return "";
  if (typeof logo === "string") return logo;
  return logo.secure_url || "";
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
        <div className="page-inner max-w-5xl">
          <div className="glass-card h-72 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page-shell">
        <div className="page-inner max-w-5xl">
          <div className="glass-card p-6">
            <p className="text-rose-200">{status.message || "Job not found."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-inner max-w-5xl space-y-5">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 md:p-8 space-y-3"
        >
          <div className="flex items-center gap-3">
            <img
              src={getLogoUrl(job.company?.logo) || "/default-avatar.png"}
              alt={job.company?.name || "Company"}
              className="h-12 w-12 rounded-xl border border-white/20 object-cover"
            />
            <div>
              <p className="text-sm muted">{job.company?.name || "Company"}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">
              {job.employmentDetails?.workMode || "Work mode not set"}
            </span>
            {job.isInvited ? (
              <span className="badge !bg-emerald-500/20 !border-emerald-400/50 !text-emerald-200">
                Invited
              </span>
            ) : (
              <span className="badge !bg-amber-500/20 !border-amber-400/50 !text-amber-200">
                Invite Required
              </span>
            )}
            {applicationStatus && (
              <span className="badge !bg-emerald-500/20 !border-emerald-400/50 !text-emerald-200">
                Status: {applicationStatus}
              </span>
            )}
          </div>
          <h1 className="section-title">{job.jobTitle}</h1>
          <p className="muted">{job.jobDescription}</p>
        </motion.header>

        <InfoSection title="Company Information">
          <InfoRow label="Name" value={job.company?.name} />
          <InfoRow label="Industry" value={job.company?.industry} />
          <InfoRow label="Website" value={job.company?.website} />
          <InfoRow label="Description" value={job.company?.description} />
        </InfoSection>

        <InfoSection title="Role Details">
          <InfoRow label="Overview" value={job.roleDetails?.overview} />
          <TagList label="Responsibilities" items={job.roleDetails?.responsibilities} />
          <TagList label="Tech Stack" items={job.roleDetails?.techStack} />
          <TagList label="Tools" items={job.roleDetails?.tools} />
        </InfoSection>

        <InfoSection title="Skills">
          <TagList label="Must Have" items={job.skills?.mustHave} />
          <TagList label="Good To Have" items={job.skills?.goodToHave} />
          <TagList label="Soft Skills" items={job.skills?.softSkills} />
        </InfoSection>

        <InfoSection title="Compensation and Employment">
          <InfoRow label="Salary" value={job.compensation?.salaryRange} />
          <InfoRow label="Stipend" value={job.compensation?.stipend} />
          <TagList label="Benefits" items={job.compensation?.benefits} />
          <InfoRow label="Employment Type" value={job.employmentDetails?.employmentType} />
          <InfoRow label="Location" value={job.employmentDetails?.location} />
          <InfoRow label="Department" value={job.employmentDetails?.department} />
          <InfoRow label="Openings" value={job.employmentDetails?.openings} />
        </InfoSection>

        <InfoSection title="Hiring and Timeline">
          <TagList label="Process Steps" items={job.hiringProcess?.steps} />
          <InfoRow label="Mode" value={job.hiringProcess?.mode} />
          <InfoRow label="Timeline" value={job.hiringProcess?.timeline} />
          <InfoRow
            label="Apply By"
            value={
              job.timeline?.applyBy
                ? new Date(job.timeline.applyBy).toLocaleDateString("en-IN")
                : "Not specified"
            }
          />
          <InfoRow
            label="Last Date"
            value={
              job.timeline?.lastDate
                ? new Date(job.timeline.lastDate).toLocaleDateString("en-IN")
                : "Not specified"
            }
          />
          <InfoRow
            label="Joining Date"
            value={
              job.timeline?.joiningDate
                ? new Date(job.timeline.joiningDate).toLocaleDateString("en-IN")
                : "Not specified"
            }
          />
        </InfoSection>

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
          disabled={Boolean(applicationStatus) || closed || applying || !job.canApply}
          onClick={handleApply}
          className="btn-primary w-full py-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {closed
            ? "Applications Closed"
            : applicationStatus
              ? `Already Applied (${applicationStatus})`
              : !job.canApply
                ? "Not Allowed To Apply"
              : applying
                ? "Applying..."
                : "Apply for this Job"}
        </motion.button>

        {!job.canApply && !closed && !applicationStatus && (
          <p className="muted text-sm">
            You can view this job, but only invited/allowed students can apply.
          </p>
        )}
      </div>
    </div>
  );
};

const InfoSection = ({ title, children }) => (
  <motion.section
    initial={{ opacity: 0, y: 8 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    className="glass-card p-6 md:p-8 space-y-3"
  >
    <h2 className="text-lg md:text-xl font-semibold">{title}</h2>
    {children}
  </motion.section>
);

const InfoRow = ({ label, value }) => (
  <p className="text-sm md:text-base">
    <span className="text-slate-300">{label}: </span>
    <span className="text-slate-100">{value || "Not specified"}</span>
  </p>
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

export default JobDetail;
