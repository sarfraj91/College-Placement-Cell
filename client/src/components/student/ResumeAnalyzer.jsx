import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import { analyzeResume, getStudentJobs } from "../../services/jobApi";
import ChatBot from "./ChatBot.jsx";
import { saveChatbotContext } from "../../utils/chatbotContext.js";
import "./ResumeAnalyzer.css";

const MAX_FILE_SIZE_MB = 5;
const ANALYSIS_MODE = {
  LISTED: "listed",
  CUSTOM: "custom"
};

const clampScore = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
};

const getScoreMeta = (score) => {
  if (score >= 75) {
    return {
      label: "Strong Fit",
      tone: "good"
    };
  }

  if (score >= 45) {
    return {
      label: "Partial Fit",
      tone: "medium"
    };
  }

  return {
    label: "Needs Work",
    tone: "low"
  };
};

const ResumeAnalyzer = ({ jobId }) => {
  const [searchParams] = useSearchParams();
  const selectedJobIdFromQuery = searchParams.get("jobId") || "";
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");

  const [analysisMode, setAnalysisMode] = useState(ANALYSIS_MODE.LISTED);
  const [selectedJobId, setSelectedJobId] = useState(
    jobId || selectedJobIdFromQuery,
  );
  const [customJobDescription, setCustomJobDescription] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [resultSource, setResultSource] = useState("");
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (jobId || selectedJobIdFromQuery) {
      setSelectedJobId(jobId || selectedJobIdFromQuery);
      setAnalysisMode(ANALYSIS_MODE.LISTED);
    }
  }, [jobId, selectedJobIdFromQuery]);

  useEffect(() => {
    let mounted = true;

    const loadJobs = async () => {
      try {
        setJobsLoading(true);
        setJobsError("");

        const res = await getStudentJobs();
        if (!mounted) return;

        const list = res?.data?.jobs || [];
        setJobs(list);

        if (!jobId && !selectedJobIdFromQuery && list.length > 0) {
          setSelectedJobId((previous) => previous || list[0]._id);
          setAnalysisMode((previous) => previous || ANALYSIS_MODE.LISTED);
        }

        if (!jobId && !selectedJobIdFromQuery && list.length === 0) {
          setAnalysisMode(ANALYSIS_MODE.CUSTOM);
        }
      } catch (err) {
        if (!mounted) return;
        setJobsError(err?.response?.data?.message || "Unable to load available jobs.");
      } finally {
        if (mounted) setJobsLoading(false);
      }
    };

    loadJobs();

    return () => {
      mounted = false;
    };
  }, [jobId, selectedJobIdFromQuery]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job._id === selectedJobId),
    [jobs, selectedJobId]
  );

  const handleFileChange = (event) => {
    const pickedFile = event.target.files?.[0];
    setResult(null);
    setError("");

    if (!pickedFile) {
      setFile(null);
      return;
    }

    const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    const isPdf =
      pickedFile.type === "application/pdf" ||
      pickedFile.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setFile(null);
      setError("Please upload a PDF resume only.");
      return;
    }

    if (pickedFile.size > maxSizeBytes) {
      setFile(null);
      setError(`Resume size should be under ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setFile(pickedFile);
  };

  const switchMode = (mode) => {
    setAnalysisMode(mode);
    setError("");
    setResult(null);
    setResultSource("");
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError("Please upload your resume PDF before analyzing.");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);
    const trimmedCustomDescription = customJobDescription.trim();

    if (analysisMode === ANALYSIS_MODE.LISTED) {
      if (!selectedJobId) {
        setError("Please select a listed job role.");
        return;
      }
      formData.append("jobId", selectedJobId);
    } else {
      if (!trimmedCustomDescription) {
        setError("Please enter a custom job description.");
        return;
      }

      formData.append("jobDescription", trimmedCustomDescription);
    }

    try {
      setAnalyzing(true);
      setError("");
      setResult(null);
      setResultSource("");

      const data = await analyzeResume(formData);

      if (!data?.success || !data?.result) {
        throw new Error(data?.message || "Resume analysis did not return a valid result.");
      }

      setResult(data.result);
      setResultSource(data?.source || analysisMode);

      saveChatbotContext({
        analyzedAt: new Date().toISOString(),
        source: data?.source || analysisMode,
        selectedJobId: usingListedJob ? selectedJobId : "",
        activeJobSnapshot: usingListedJob
          ? {
              jobId: selectedJob?._id || "",
              jobTitle: selectedJob?.jobTitle || "",
              company: selectedJob?.company?.name || "",
              description: selectedJob?.jobDescription || "",
              skills: selectedJob?.skills?.mustHave || [],
              location: selectedJob?.employmentDetails?.location || "",
              workMode: selectedJob?.employmentDetails?.workMode || "",
              employmentType: selectedJob?.employmentDetails?.employmentType || "",
            }
          : {
              jobId: "",
              jobTitle: "Custom Job Description",
              company: "Custom",
              description: trimmedCustomDescription,
              skills: data?.result?.jobSkills || [],
              location: "",
              workMode: "",
              employmentType: "",
            },
        resumeAnalysis: data.result,
      });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Resume analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const usingListedJob = analysisMode === ANALYSIS_MODE.LISTED;
  const finalScore = clampScore(result?.finalScore ?? result?.score ?? 0);
  const keywordScore = clampScore(result?.keywordScore ?? 0);
  const semanticScore = clampScore(result?.semanticScore ?? 0);
  const scoreMeta = getScoreMeta(finalScore);
  const analyzeDisabled =
    analyzing ||
    !file ||
    (usingListedJob ? jobsLoading || !selectedJobId : !customJobDescription.trim());
  const sourceLabel =
    resultSource === ANALYSIS_MODE.CUSTOM ? "Custom Description" : "Listed Job Role";
  const skillGap = clampScore(result?.skillGapPercent ?? 0);
  const resumeSkills = Array.isArray(result?.resumeSkills) ? result.resumeSkills : [];
  const jobSkills = Array.isArray(result?.jobSkills) ? result.jobSkills : [];
  const matchedSkills = Array.isArray(result?.matchedSkills) ? result.matchedSkills : [];
  const missingSkills = Array.isArray(result?.missingSkills) ? result.missingSkills : [];
  const suggestions = Array.isArray(result?.suggestions) ? result.suggestions : [];
  const recommendedJobs = Array.isArray(result?.recommendedJobs) ? result.recommendedJobs : [];
  const externalJobs = Array.isArray(result?.externalJobs) ? result.externalJobs : [];

  return (
    <div className="page-shell">
      <ChatBot
        selectedJobId={selectedJobId}
        resumeAnalysis={result}
      />
      <div className="page-inner resume-analyzer-page">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card ra-hero"
        >
          <p className="ra-kicker">AI Resume Screening</p>
          <h1 className="section-title">Resume Analyzer</h1>
          <p className="muted ra-hero-copy">Upload, analyze, and explore matching jobs.</p>
          <div className="ra-hero-badges">
            <span className="badge">Keyword Match</span>
            <span className="badge">Semantic Match</span>
            <span className="badge">Listed Jobs</span>
            <span className="badge">Other Jobs</span>
          </div>
        </motion.header>

        <div className="ra-layout">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-card ra-form-panel"
          >
            <div className="ra-panel-head">
              <h2>Analyze Your Resume</h2>
              <p className="muted">Choose a source and upload your PDF.</p>
            </div>

            <div className="ra-mode-switch">
              <button
                type="button"
                onClick={() => switchMode(ANALYSIS_MODE.LISTED)}
                disabled={analyzing || (jobsLoading && !jobs.length)}
                className={`ra-mode-btn ${
                  usingListedJob
                    ? "is-active"
                    : ""
                }`}
              >
                Listed Job
              </button>
              <button
                type="button"
                onClick={() => switchMode(ANALYSIS_MODE.CUSTOM)}
                disabled={analyzing}
                className={`ra-mode-btn ${
                  !usingListedJob
                    ? "is-active"
                    : ""
                }`}
              >
                Custom Description
              </button>
            </div>

            {usingListedJob ? (
              <label className="ra-field">
                <span className="input-label">Choose Job Role</span>
                <select
                  value={selectedJobId}
                  onChange={(event) => {
                    setSelectedJobId(event.target.value);
                    setResult(null);
                    setResultSource("");
                  }}
                  disabled={jobsLoading || analyzing}
                  className="select"
                >
                  {jobsLoading && <option value="">Loading jobs...</option>}
                  {!jobsLoading && jobs.length === 0 && <option value="">No jobs available</option>}
                  {!jobsLoading && jobs.length > 0 && jobs.map((job) => (
                    <option key={job._id} value={job._id}>
                      {job.jobTitle} - {job.company?.name || "Company"}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="ra-field">
                <span className="input-label">Custom Job Description</span>
                <textarea
                  rows={8}
                  value={customJobDescription}
                  onChange={(event) => {
                    setCustomJobDescription(event.target.value);
                    setResult(null);
                    setResultSource("");
                  }}
                  disabled={analyzing}
                  placeholder="Paste the full job description here..."
                  className="textarea ra-textarea"
                />
              </label>
            )}

            <label className="ra-field">
              <span className="input-label">Upload Resume (PDF, up to 5MB)</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                disabled={analyzing}
                className="input ra-file-input"
              />
            </label>

            {file && (
              <div className="ra-file-meta">
                <span>{file.name}</span>
                <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            )}

            {usingListedJob && selectedJob && (
              <div className="ra-selected-job">
                <p>{selectedJob.jobTitle}</p>
                <span>{selectedJob.company?.name || "Company not specified"}</span>
              </div>
            )}

            {jobsError && <p className="ra-alert ra-alert-error">{jobsError}</p>}
            {error && <p className="ra-alert ra-alert-error">{error}</p>}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleAnalyze}
              disabled={analyzeDisabled}
              className="btn-primary ra-submit-btn"
            >
              {analyzing ? "Analyzing Resume..." : "Run Analysis"}
            </motion.button>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="glass-card ra-info-panel"
          >
            <h3>Quick View</h3>
            <CompactInfoCard
              label="Mode"
              value={usingListedJob ? "Listed Job" : "Custom Description"}
            />
            <CompactInfoCard
              label="Source"
              value={
                usingListedJob
                  ? selectedJob
                    ? `${selectedJob.jobTitle} · ${selectedJob.company?.name || "Company"}`
                    : "Select a listed job"
                  : customJobDescription.trim()
                    ? "Custom description added"
                    : "Add custom description"
              }
            />
            <CompactInfoCard
              label="Resume"
              value={file ? file.name : "Upload PDF resume"}
            />
          </motion.aside>
        </div>

        {result && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card ra-results-panel"
          >
            <div className="ra-results-head">
              <div>
                <h2>Analysis Report</h2>
                <p className="muted">{sourceLabel}</p>
              </div>
              <span className={`ra-score-chip ${scoreMeta.tone}`}>
                {finalScore}% {scoreMeta.label}
              </span>
            </div>

            <div className="ra-progress-track">
              <div
                className={`ra-progress-fill ${scoreMeta.tone}`}
                style={{ width: `${finalScore}%` }}
              />
            </div>

            <div className="ra-metric-grid">
              <MetricCard
                title="Overall Match"
                value={`${finalScore}%`}
              />
              <MetricCard
                title="Keyword Score"
                value={`${keywordScore}%`}
              />
              <MetricCard
                title="Semantic Score"
                value={`${semanticScore}%`}
              />
              <MetricCard
                title="Skill Gap"
                value={`${skillGap}%`}
              />
            </div>

            <div className="ra-result-grid">
              <ResultList
                title="Resume Skills"
                tone="neutral"
                items={resumeSkills}
                emptyText="No resume skills were extracted."
              />

              <ResultList
                title="Job Skills"
                tone="neutral"
                items={jobSkills}
                emptyText="No job skills were extracted."
              />

              <ResultList
                title="Matched Skills"
                tone="good"
                items={matchedSkills}
                emptyText="No direct skill match found yet."
              />

              <ResultList
                title="Missing Skills"
                tone="medium"
                items={missingSkills}
                emptyText="Great. No critical skills are missing."
              />
            </div>

            <ResultList
              title="Suggestions"
              tone="neutral"
              items={suggestions}
              emptyText="Your resume already covers key sections."
            />

            <RecommendationSection
              title="Listed Jobs"
              emptyText="No listed jobs found."
            >
              {recommendedJobs.map((job) => (
                <InternalJobCard key={job._id} job={job} />
              ))}
            </RecommendationSection>

            <RecommendationSection
              title="Other Jobs"
              emptyText="No other jobs found."
            >
              {externalJobs.map((job) => (
                <ExternalLeadCard key={`${job.source}-${job.role}`} job={job} />
              ))}
            </RecommendationSection>
          </motion.section>
        )}
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, subtitle }) => (
  <article className="ra-metric-card">
    <p className="ra-metric-title">{title}</p>
    <p className="ra-metric-value">{value}</p>
    {subtitle ? <p className="muted ra-metric-subtitle">{subtitle}</p> : null}
  </article>
);

const CompactInfoCard = ({ label, value }) => (
  <div className="ra-info-box ra-info-box-compact">
    <p className="ra-info-label">{label}</p>
    <p>{value}</p>
  </div>
);

const ResultList = ({ title, tone, items = [], emptyText }) => {
  const toneClass = {
    good: "ra-list-good",
    medium: "ra-list-medium",
    neutral: "ra-list-neutral"
  }[tone];

  return (
    <section className="ra-result-list">
      <h3>{title}</h3>
      {Array.isArray(items) && items.length > 0 ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${title}-${index}-${item}`} className={toneClass}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ra-empty-item">{emptyText}</p>
      )}
    </section>
  );
};

const RecommendationSection = ({ title, children, emptyText }) => {
  const hasChildren = Array.isArray(children) && children.length > 0;

  return (
    <section className="ra-recommendation-section">
      <div className="ra-section-head">
        <h3>{title}</h3>
      </div>

      {hasChildren ? (
        <div className="ra-job-grid">{children}</div>
      ) : (
        <p className="ra-empty-item">{emptyText}</p>
      )}
    </section>
  );
};

const InternalJobCard = ({ job }) => (
  <article className="ra-job-card">
    <div className="ra-job-card-head">
      <span className="ra-source-pill">Listed Job</span>
      <span className="ra-count-pill">{job.matchCount || 0} matches</span>
    </div>

    <h4>{job.jobTitle}</h4>
    <p className="muted ra-job-company">{job.company?.name || "Company"}</p>
    <p className="ra-job-meta">
      {[job.employmentDetails?.employmentType, job.employmentDetails?.workMode, job.employmentDetails?.location]
        .filter(Boolean)
        .join(" • ") || "Campus listing"}
    </p>

    <SkillPillRow items={job.matchedSkills} />

    <div className="ra-job-actions">
      <Link to={`/student/jobs/${job._id}`} className="btn-primary ra-action-link">
        Open Job
      </Link>
    </div>
  </article>
);

const ExternalLeadCard = ({ job }) => (
  <article className="ra-job-card ra-job-card-external">
    <div className="ra-job-card-head">
      <span className="ra-source-pill">{job.source}</span>
      <span className="ra-count-pill">{job.location || "India"}</span>
    </div>

    <h4>{job.role}</h4>
    <p className="muted ra-job-company">{job.location || "India"}</p>

    <SkillPillRow items={job.matchedSkills} />

    <div className="ra-job-actions">
      <a
        href={job.applyUrl}
        target="_blank"
        rel="noreferrer"
        className="btn-primary ra-action-link"
      >
        Open
      </a>
    </div>
  </article>
);

const SkillPillRow = ({ items = [] }) => (
  <div className="ra-skill-pills">
    {items.length > 0 ? (
      items.map((item) => (
        <span key={item} className="ra-skill-pill">
          {item}
        </span>
      ))
    ) : (
      <span className="muted text-sm">Skill context unavailable</span>
    )}
  </div>
);

export default ResumeAnalyzer;
