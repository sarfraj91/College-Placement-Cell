import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  createJob,
  generateJobDescription,
} from "../../services/jobApi.jsx";

const IconBase = ({ className = "", children }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

const Briefcase = ({ className }) => (
  <IconBase className={className}>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <path d="M2 13h20" />
  </IconBase>
);

const Building2 = ({ className }) => (
  <IconBase className={className}>
    <path d="M3 21h18" />
    <path d="M5 21V7l7-3 7 3v14" />
    <path d="M9 10h2" />
    <path d="M13 10h2" />
    <path d="M9 14h2" />
    <path d="M13 14h2" />
    <path d="M11 21v-3h2v3" />
  </IconBase>
);

const CalendarClock = ({ className }) => (
  <IconBase className={className}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M8 2v4M16 2v4M3 10h12" />
    <circle cx="17" cy="15" r="4" />
    <path d="M17 13.5v2.1l1.4 0.9" />
  </IconBase>
);

const CheckCircle2 = ({ className }) => (
  <IconBase className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </IconBase>
);

const ChevronDown = ({ className }) => (
  <IconBase className={className}>
    <path d="m6 9 6 6 6-6" />
  </IconBase>
);

const ChevronUp = ({ className }) => (
  <IconBase className={className}>
    <path d="m18 15-6-6-6 6" />
  </IconBase>
);

const DollarSign = ({ className }) => (
  <IconBase className={className}>
    <path d="M12 2v20" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7" />
  </IconBase>
);

const Eye = ({ className }) => (
  <IconBase className={className}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
    <circle cx="12" cy="12" r="3" />
  </IconBase>
);

const FileText = ({ className }) => (
  <IconBase className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8M8 17h8M8 9h2" />
  </IconBase>
);

const GraduationCap = ({ className }) => (
  <IconBase className={className}>
    <path d="m2 10 10-5 10 5-10 5-10-5Z" />
    <path d="M6 12v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4" />
  </IconBase>
);

const Loader2 = ({ className }) => (
  <IconBase className={className}>
    <path d="M21 12a9 9 0 1 1-3.2-6.9" />
  </IconBase>
);

const MapPin = ({ className }) => (
  <IconBase className={className}>
    <path d="M12 22s7-5.7 7-12a7 7 0 1 0-14 0c0 6.3 7 12 7 12Z" />
    <circle cx="12" cy="10" r="2.5" />
  </IconBase>
);

const Plus = ({ className }) => (
  <IconBase className={className}>
    <path d="M12 5v14M5 12h14" />
  </IconBase>
);

const Save = ({ className }) => (
  <IconBase className={className}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </IconBase>
);

const Send = ({ className }) => (
  <IconBase className={className}>
    <path d="M22 2 11 13" />
    <path d="m22 2-7 20-4-9-9-4Z" />
  </IconBase>
);

const Sparkles = ({ className }) => (
  <IconBase className={className}>
    <path d="M12 3l1.5 3.8L17 8.3l-3.5 1.5L12 13.5l-1.5-3.7L7 8.3l3.5-1.5Z" />
    <path d="m5 16 .8 1.9L7.7 19l-1.9.8L5 21.7l-.8-1.9L2.3 19l1.9-.8Z" />
    <path d="m18.5 14 .9 2.2 2.1.9-2.1.9-.9 2.2-.9-2.2-2.1-.9 2.1-.9Z" />
  </IconBase>
);

const Tags = ({ className }) => (
  <IconBase className={className}>
    <path d="m3 7 7-4 11 11-7 7L3 10Z" />
    <circle cx="8.5" cy="8.5" r="1.5" />
  </IconBase>
);

const X = ({ className }) => (
  <IconBase className={className}>
    <path d="m18 6-12 12M6 6l12 12" />
  </IconBase>
);

const PRESET_SKILLS = [
  "Python",
  "SQL",
  "Machine Learning",
  "React",
  "Node.js",
  "Tableau",
  "Power BI",
];

const BRANCH_OPTIONS = [
  "CSE",
  "IT",
  "ECE",
  "EEE",
  "Mechanical",
  "Civil",
  "Data Science",
  "AIML",
];

const JOB_TYPES = ["Full Time", "Internship", "Remote"];

const INITIAL_FORM = {
  jobTitle: "",
  companyName: "",
  companyAbout: "",
  companyWebsite: "",
  location: "",
  salaryRange: "",
  jobType: "Full Time",
  experienceRequired: "",
  applicationDeadline: "",
  jobDescription: "",
  skills: [],
  minCgpa: "",
  eligibleBranches: [],
  graduationYear: "",
};

const toUniqueTags = (items = []) =>
  [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];

const toWordCount = (text = "") =>
  String(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const sanitizeGeneratedDescription = (text = "") =>
  String(text)
    .replace(/\r\n/g, "\n")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const toBackendPayload = (form) => {
  const employmentType =
    form.jobType === "Internship"
      ? "Internship"
      : form.jobType === "Remote"
        ? "Full-time"
        : "Full-time";
  const workMode = form.jobType === "Remote" ? "Remote" : "Onsite/Hybrid";

  return {
    jobTitle: form.jobTitle.trim(),
    jobDescription: form.jobDescription.trim(),
    company: {
      name: form.companyName.trim(),
      description: form.companyAbout.trim(),
      website: form.companyWebsite.trim(),
      industry: "",
    },
    employmentDetails: {
      employmentType,
      workMode,
      location: form.location.trim(),
      department: "",
      openings: 1,
    },
    roleDetails: {
      overview: "",
      responsibilities: [],
      projects: "",
      techStack: toUniqueTags(form.skills),
      tools: [],
    },
    skills: {
      mustHave: toUniqueTags(form.skills),
      goodToHave: [],
      softSkills: [],
    },
    compensation: {
      salaryRange: form.salaryRange.trim(),
      stipend: "",
      benefits: [],
    },
    hiringProcess: {
      steps: [],
      mode: "",
      timeline: form.experienceRequired.trim(),
    },
    timeline: {
      applyBy: "",
      lastDate: form.applicationDeadline,
      joiningDate: "",
    },
    visibility: "EligibleStudents",
  };
};

const fallbackDescription = (form) =>
  `${form.companyName || "Our organization"} is hiring a ${
    form.jobTitle || "professional"
  }.

Role Overview:
- Work Location: ${form.location || "As per business requirement"}
- Job Type: ${form.jobType || "Full Time"}
- Experience Required: ${form.experienceRequired || "As per role"}
- Salary Range: ${form.salaryRange || "Competitive"}

Key Responsibilities:
- Build and deliver high-impact features with quality and ownership.
- Collaborate with engineering, product, and business teams.
- Ensure reliability, scalability, and maintainability of deliverables.

Must-Have Skills:
${(form.skills.length ? form.skills : ["Problem Solving", "Communication"])
  .map((skill) => `- ${skill}`)
  .join("\n")}

Eligibility:
- Minimum CGPA: ${form.minCgpa || "As per company policy"}
- Eligible Branches: ${
    form.eligibleBranches.length ? form.eligibleBranches.join(", ") : "Open"
  }
- Graduation Year: ${form.graduationYear || "Open"}

Apply before ${form.applicationDeadline || "the deadline"}.
`;

const PostJob = () => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [companyLogoFile, setCompanyLogoFile] = useState(null);
  const [companyLogoPreview, setCompanyLogoPreview] = useState("");
  const [customSkill, setCustomSkill] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationAction, setGenerationAction] = useState("");
  const [improvementInstructions, setImprovementInstructions] = useState("");
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const descriptionRef = useRef(null);

  useEffect(() => {
    const raw = localStorage.getItem("admin-job-draft");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setForm((prev) => ({ ...prev, ...parsed }));
    } catch {
      localStorage.removeItem("admin-job-draft");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (companyLogoPreview) {
        URL.revokeObjectURL(companyLogoPreview);
      }
    };
  }, [companyLogoPreview]);

  const completionSteps = useMemo(
    () => [
      {
        label: "Basic Details",
        done:
          !!form.jobTitle.trim() &&
          !!form.companyName.trim() &&
          !!form.location.trim(),
      },
      {
        label: "Description & Skills",
        done: toWordCount(form.jobDescription) > 20 && form.skills.length > 0,
      },
      {
        label: "Eligibility",
        done:
          !!String(form.minCgpa).trim() &&
          form.eligibleBranches.length > 0 &&
          !!form.graduationYear,
      },
      {
        label: "Ready to Publish",
        done:
          !!form.salaryRange.trim() &&
          !!form.experienceRequired.trim() &&
          !!form.applicationDeadline,
      },
    ],
    [form],
  );

  const completionPercentage = useMemo(() => {
    const done = completionSteps.filter((step) => step.done).length;
    return Math.round((done / completionSteps.length) * 100);
  }, [completionSteps]);

  const descriptionWords = useMemo(
    () => toWordCount(form.jobDescription),
    [form.jobDescription],
  );

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSkill = (skill) => {
    setForm((prev) => {
      const exists = prev.skills.includes(skill);
      return {
        ...prev,
        skills: exists
          ? prev.skills.filter((s) => s !== skill)
          : [...prev.skills, skill],
      };
    });
  };

  const addCustomSkill = () => {
    const tag = customSkill.trim();
    if (!tag) return;
    toggleSkill(tag);
    setCustomSkill("");
  };

  const removeSkill = (skill) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  };

  const toggleBranch = (branch) => {
    setForm((prev) => {
      const exists = prev.eligibleBranches.includes(branch);
      return {
        ...prev,
        eligibleBranches: exists
          ? prev.eligibleBranches.filter((b) => b !== branch)
          : [...prev.eligibleBranches, branch],
      };
    });
  };

  const insertMarkdown = (snippet) => {
    const textarea = descriptionRef.current;
    if (!textarea) {
      handleChange("jobDescription", `${form.jobDescription}\n${snippet}`);
      return;
    }

    const { selectionStart, selectionEnd } = textarea;
    const current = form.jobDescription;
    const next =
      current.slice(0, selectionStart) +
      snippet +
      current.slice(selectionEnd, current.length);

    handleChange("jobDescription", next);
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = selectionStart + snippet.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  const handleGenerateDescription = async (mode = "generate") => {
    if (!form.jobTitle.trim() || !form.companyName.trim()) {
      setStatus({
        type: "error",
        message: "Add Job Title and Company Name first.",
      });
      return;
    }

    if (mode === "regenerate" && !form.jobDescription.trim()) {
      setStatus({
        type: "error",
        message: "Generate or write a job description before regenerating it.",
      });
      return;
    }

    if (mode === "regenerate" && !improvementInstructions.trim()) {
      setStatus({
        type: "error",
        message: "Add improvement instructions before regenerating.",
      });
      return;
    }

    setGenerating(true);
    setGenerationAction(mode);
    setStatus({ type: "", message: "" });
    try {
      const response = await generateJobDescription({
        jobTitle: form.jobTitle,
        companyName: form.companyName,
        companyOverview: form.companyAbout,
        location: form.location,
        employmentType: form.jobType,
        experienceLevel: form.experienceRequired,
        skills: form.skills,
        currentDescription: mode === "regenerate" ? form.jobDescription : "",
        improvementInstructions:
          mode === "regenerate" ? improvementInstructions : "",
      });

      const aiText = sanitizeGeneratedDescription(response?.description || "");
      if (!aiText) {
        throw new Error("AI returned empty description");
      }

      handleChange("jobDescription", aiText);
      setStatus({
        type: String(response?.provider || "").includes("fallback") ? "warning" : "success",
        message:
          response?.warning ||
          (mode === "regenerate"
            ? "Job description regenerated with your instructions."
            : "Job description generated. Review and refine before publishing."),
      });
    } catch (error) {
      if (mode === "generate") {
        handleChange("jobDescription", fallbackDescription(form));
      }
      setStatus({
        type: "warning",
        message:
          error?.response?.data?.message ||
          (mode === "regenerate"
            ? "AI is unavailable right now. Your current description was kept unchanged."
            : "AI is unavailable right now. A smart fallback description has been added."),
      });
    } finally {
      setGenerating(false);
      setGenerationAction("");
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setStatus({ type: "", message: "" });
    try {
      localStorage.setItem("admin-job-draft", JSON.stringify(form));
      setStatus({ type: "success", message: "Draft saved locally." });
    } catch {
      setStatus({ type: "error", message: "Could not save draft." });
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      await createJob(toBackendPayload(form), companyLogoFile);
      localStorage.removeItem("admin-job-draft");
      setStatus({
        type: "success",
        message: "Job published successfully.",
      });
      setForm(INITIAL_FORM);
      setCompanyLogoFile(null);
      setCompanyLogoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      setCustomSkill("");
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.response?.data?.message || "Failed to publish job.",
      });
    } finally {
      setLoading(false);
    }
  };

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, idx) => String(current + idx - 1));
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-8 text-slate-100 md:px-6">
      <div className="pointer-events-none absolute -left-28 -top-16 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/15 bg-white/5 p-6 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Post New Job
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Publish job opportunities and invite shortlisted students.
              </p>
            </div>

            <div className="min-w-[260px] rounded-xl border border-cyan-300/30 bg-slate-900/70 p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                <span>Progress</span>
                <span>{completionPercentage}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-700/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400 transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-2 md:grid-cols-4">
            {completionSteps.map((step, index) => (
              <div
                key={step.label}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                  step.done
                    ? "border-emerald-300/45 bg-emerald-400/10 text-emerald-200"
                    : "border-slate-600/70 bg-slate-800/40 text-slate-300"
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-500 text-[10px]">
                    {index + 1}
                  </span>
                )}
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </motion.header>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <motion.form
            onSubmit={handlePublish}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <SectionCard title="Smart Job Form" icon={Briefcase}>
              <div className="grid gap-4 md:grid-cols-2">
                <FloatingInput
                  id="job-title"
                  label="Job Title"
                  icon={Briefcase}
                  required
                  value={form.jobTitle}
                  onChange={(e) => handleChange("jobTitle", e.target.value)}
                />
                <FloatingInput
                  id="company-name"
                  label="Company Name"
                  icon={Building2}
                  required
                  value={form.companyName}
                  onChange={(e) => handleChange("companyName", e.target.value)}
                />
                <FloatingInput
                  id="location"
                  label="Location"
                  icon={MapPin}
                  required
                  value={form.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                />
                <FloatingInput
                  id="salary-range"
                  label="Salary Range"
                  icon={DollarSign}
                  required
                  value={form.salaryRange}
                  onChange={(e) => handleChange("salaryRange", e.target.value)}
                />
                <SelectField
                  id="job-type"
                  label="Job Type"
                  icon={Briefcase}
                  value={form.jobType}
                  options={JOB_TYPES}
                  onChange={(e) => handleChange("jobType", e.target.value)}
                />
                <FloatingInput
                  id="experience-required"
                  label="Experience Required"
                  icon={FileText}
                  required
                  value={form.experienceRequired}
                  onChange={(e) =>
                    handleChange("experienceRequired", e.target.value)
                  }
                />
                <FloatingInput
                  id="application-deadline"
                  label="Application Deadline"
                  type="date"
                  icon={CalendarClock}
                  required
                  value={form.applicationDeadline}
                  onChange={(e) =>
                    handleChange("applicationDeadline", e.target.value)
                  }
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <FloatingInput
                  id="company-website"
                  label="Company Website"
                  icon={Building2}
                  value={form.companyWebsite}
                  onChange={(e) => handleChange("companyWebsite", e.target.value)}
                  placeholder="https://example.com"
                />

                <div className="rounded-xl border border-slate-600/70 bg-slate-900/80 p-3">
                  <label className="mb-2 block text-xs font-medium text-slate-300">
                    Company Logo / Image
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-cyan-100"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setCompanyLogoFile(file);
                      setCompanyLogoPreview((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return file ? URL.createObjectURL(file) : "";
                      });
                    }}
                  />
                  {companyLogoPreview && (
                    <img
                      src={companyLogoPreview}
                      alt="Company logo preview"
                      className="mt-3 h-14 w-14 rounded-lg border border-slate-600/70 object-cover"
                    />
                  )}
                </div>
              </div>

              <div className="mt-4">
                <FloatingTextarea
                  id="company-about"
                  label="About Company"
                  value={form.companyAbout}
                  onChange={(e) => handleChange("companyAbout", e.target.value)}
                  rows={4}
                />
              </div>
            </SectionCard>

            <SectionCard title="AI Job Description Generator" icon={Sparkles}>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerateDescription("generate")}
                  disabled={generating}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {generationAction === "generate" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Generate with AI
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerateDescription("regenerate")}
                  disabled={generating}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-300/35 bg-indigo-400/15 px-4 py-2 text-sm font-medium text-indigo-100 transition hover:bg-indigo-400/25 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {generationAction === "regenerate" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Regenerate
                </button>

                <button
                  type="button"
                  onClick={() => insertMarkdown("\n- ")}
                  className="rounded-lg border border-slate-600/70 bg-slate-800/70 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-300/40"
                >
                  + Bullet
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("\nSection:\n")}
                  className="rounded-lg border border-slate-600/70 bg-slate-800/70 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-300/40"
                >
                  + Section
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("\n- Add point here")}
                  className="rounded-lg border border-slate-600/70 bg-slate-800/70 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-300/40"
                >
                  + Point
                </button>
                <button
                  type="button"
                  onClick={() => setEditorExpanded((prev) => !prev)}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-600/70 bg-slate-800/70 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-300/40"
                >
                  {editorExpanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" /> Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" /> Expand
                    </>
                  )}
                </button>
              </div>

              <div className="mb-4 rounded-xl border border-slate-600/70 bg-slate-900/80 p-3">
                <label
                  htmlFor="regenerate-instructions"
                  className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-300"
                >
                  Improve Description
                </label>
                <textarea
                  id="regenerate-instructions"
                  value={improvementInstructions}
                  onChange={(e) => setImprovementInstructions(e.target.value)}
                  rows={3}
                  placeholder="Example: make it shorter, add internship tone, highlight Python and SQL, improve benefits section."
                  className="w-full rounded-xl border border-slate-600/70 bg-slate-950/80 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/20"
                />
              </div>

              <FloatingTextarea
                textareaRef={descriptionRef}
                id="job-description"
                label="Job Description"
                value={form.jobDescription}
                rows={editorExpanded ? 16 : 8}
                required
                onChange={(e) => handleChange("jobDescription", e.target.value)}
              />

              <div className="mt-2 text-xs text-slate-400">
                {descriptionWords} words
              </div>
            </SectionCard>

            <SectionCard title="Skills" icon={Tags}>
              <div className="mb-4 flex flex-wrap gap-2">
                {PRESET_SKILLS.map((skill) => {
                  const selected = form.skills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        selected
                          ? "border-cyan-300/55 bg-cyan-400/20 text-cyan-100"
                          : "border-slate-600/70 bg-slate-800/60 text-slate-300 hover:border-cyan-300/40"
                      }`}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>

              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={customSkill}
                  onChange={(e) => setCustomSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomSkill();
                    }
                  }}
                  placeholder="Add custom skill"
                  className="w-full rounded-xl border border-slate-600/70 bg-slate-900/80 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/20"
                />
                <button
                  type="button"
                  onClick={addCustomSkill}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-600/70 bg-slate-800/80 px-3 py-2.5 text-sm hover:border-cyan-300/40"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {form.skills.length === 0 && (
                  <p className="text-xs text-slate-400">No skills selected yet.</p>
                )}
                {form.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 rounded-full border border-cyan-300/45 bg-cyan-400/15 px-3 py-1.5 text-xs text-cyan-100"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="rounded-full p-0.5 hover:bg-black/20"
                      aria-label={`Remove ${skill}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Eligibility" icon={GraduationCap}>
              <div className="grid gap-4 md:grid-cols-3">
                <FloatingInput
                  id="min-cgpa"
                  label="Minimum CGPA"
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={form.minCgpa}
                  onChange={(e) => handleChange("minCgpa", e.target.value)}
                />
                <SelectField
                  id="graduation-year"
                  label="Graduation Year"
                  value={form.graduationYear}
                  options={years}
                  onChange={(e) => handleChange("graduationYear", e.target.value)}
                />
              </div>

              <p className="mb-2 mt-4 text-xs font-medium text-slate-300">
                Eligible Branches
              </p>
              <div className="flex flex-wrap gap-2">
                {BRANCH_OPTIONS.map((branch) => {
                  const selected = form.eligibleBranches.includes(branch);
                  return (
                    <button
                      key={branch}
                      type="button"
                      onClick={() => toggleBranch(branch)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        selected
                          ? "border-indigo-300/55 bg-indigo-400/20 text-indigo-100"
                          : "border-slate-600/70 bg-slate-800/60 text-slate-300 hover:border-indigo-300/45"
                      }`}
                    >
                      {branch}
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {status.message && (
              <p
                className={`rounded-xl border px-4 py-3 text-sm ${
                  status.type === "success"
                    ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-100"
                    : status.type === "warning"
                      ? "border-amber-300/50 bg-amber-400/15 text-amber-100"
                      : "border-rose-300/50 bg-rose-400/15 text-rose-100"
                }`}
              >
                {status.message}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingDraft || loading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-500/70 bg-slate-800/80 px-5 py-2.5 text-sm font-medium transition hover:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {savingDraft ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Draft
              </button>

              <button
                type="submit"
                disabled={loading || generating}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/45 bg-gradient-to-r from-cyan-400/80 to-indigo-400/80 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {loading ? "Publishing..." : "Publish Job"}
              </button>
            </div>
          </motion.form>

          <motion.aside
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-fit rounded-2xl border border-white/15 bg-white/5 p-5 shadow-xl backdrop-blur-xl xl:sticky xl:top-24"
          >
            <div className="mb-4 flex items-center gap-2">
              <Eye className="h-4 w-4 text-cyan-300" />
              <h2 className="text-base font-semibold">Live Job Preview</h2>
            </div>

            <div className="rounded-xl border border-slate-600/70 bg-slate-900/80 p-4">
              <div className="mb-3 flex items-center gap-3">
                <img
                  src={companyLogoPreview || "/default-avatar.png"}
                  alt={form.companyName || "Company"}
                  className="h-10 w-10 rounded-lg border border-slate-600/70 object-cover"
                />
                <div>
                  <p className="text-xs text-slate-400">Company</p>
                  <p className="text-sm text-slate-200">
                    {form.companyName || "Company Name"}
                  </p>
                </div>
              </div>

              <h3 className="text-lg font-semibold">
                {form.jobTitle || "Job Title"}
              </h3>
              {form.companyAbout && (
                <p className="mt-2 text-sm text-slate-300">{form.companyAbout}</p>
              )}
              {form.companyWebsite && (
                <p className="mt-1 text-xs text-cyan-200">{form.companyWebsite}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <Tag>{form.location || "Location"}</Tag>
                <Tag>{form.jobType || "Job Type"}</Tag>
                <Tag>{form.salaryRange || "Salary Range"}</Tag>
                <Tag>{form.experienceRequired || "Experience"}</Tag>
              </div>

              <div className="mt-5 space-y-2 text-sm text-slate-200">
                <p className="font-medium">Description</p>
                <div className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-700/80 bg-slate-950/70 p-3 text-sm leading-relaxed text-slate-300">
                  {form.jobDescription || "Job description preview appears here."}
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <p className="text-sm font-medium">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {form.skills.length ? (
                    form.skills.map((skill) => <Tag key={skill}>{skill}</Tag>)
                  ) : (
                    <p className="text-xs text-slate-400">No skills added.</p>
                  )}
                </div>
              </div>

              <div className="mt-5 space-y-1 text-xs text-slate-300">
                <p>Minimum CGPA: {form.minCgpa || "Not set"}</p>
                <p>
                  Branches: {" "}
                  {form.eligibleBranches.length
                    ? form.eligibleBranches.join(", ")
                    : "Not selected"}
                </p>
                <p>Graduation Year: {form.graduationYear || "Not selected"}</p>
                <p>
                  Deadline: {" "}
                  {form.applicationDeadline
                    ? new Date(form.applicationDeadline).toLocaleDateString("en-IN")
                    : "Not set"}
                </p>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
};

const SectionCard = ({ title, icon: Icon, children }) => (
  <motion.section
    initial={{ opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    className="rounded-2xl border border-white/15 bg-white/5 p-5 shadow-xl backdrop-blur-xl"
  >
    <div className="mb-4 flex items-center gap-2">
      {Icon ? <Icon className="h-4 w-4 text-cyan-300" /> : null}
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
    {children}
  </motion.section>
);

const FloatingInput = ({
  id,
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  required = false,
  ...props
}) => (
  <div className="relative">
    {Icon ? (
      <Icon className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
    ) : null}
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      required={required}
      placeholder=" "
      className={`peer w-full rounded-xl border border-slate-600/70 bg-slate-900/80 px-3 pb-2.5 pt-6 text-sm outline-none transition placeholder:text-transparent focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/20 ${
        Icon ? "pl-10" : ""
      }`}
      {...props}
    />
    <label
      htmlFor={id}
      className={`pointer-events-none absolute top-2 z-10 origin-left text-xs text-slate-400 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-500 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-cyan-300 ${
        Icon ? "left-10" : "left-3"
      }`}
    >
      {label}
    </label>
  </div>
);

const FloatingTextarea = ({
  id,
  label,
  value,
  onChange,
  rows = 8,
  required = false,
  textareaRef,
}) => (
  <div className="relative">
    <textarea
      ref={textareaRef}
      id={id}
      value={value}
      onChange={onChange}
      rows={rows}
      required={required}
      placeholder=" "
      className="peer w-full rounded-xl border border-slate-600/70 bg-slate-900/80 px-3 pb-2.5 pt-6 text-sm outline-none transition placeholder:text-transparent focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/20"
    />
    <label
      htmlFor={id}
      className="pointer-events-none absolute left-3 top-2 z-10 origin-left text-xs text-slate-400 transition-all peer-placeholder-shown:top-6 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-500 peer-focus:top-2 peer-focus:text-xs peer-focus:text-cyan-300"
    >
      {label}
    </label>
  </div>
);

const SelectField = ({ id, label, icon: Icon, value, onChange, options }) => (
  <div className="relative">
    {Icon ? (
      <Icon className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
    ) : null}
    <label
      htmlFor={id}
      className={`absolute top-1.5 text-[10px] uppercase tracking-wide text-slate-400 ${
        Icon ? "left-10" : "left-3"
      }`}
    >
      {label}
    </label>
    <select
      id={id}
      value={value}
      onChange={onChange}
      className={`w-full rounded-xl border border-slate-600/70 bg-slate-900/80 pb-2.5 pt-5 text-sm outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/20 ${
        Icon ? "pl-10 pr-3" : "px-3"
      }`}
    >
      <option value="">Select</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>
);

const Tag = ({ children }) => (
  <span className="inline-flex rounded-full border border-slate-500/70 bg-slate-800/80 px-2.5 py-1 text-[11px] text-slate-200">
    {children}
  </span>
);

export default PostJob;
