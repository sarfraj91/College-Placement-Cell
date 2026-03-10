import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createJob } from "../../services/jobApi.jsx";

const initialJob = {
  jobTitle: "",
  jobDescription: "",
  company: {
    name: "",
    description: "",
    website: "",
    industry: "",
  },
  employmentDetails: {
    employmentType: "",
    workMode: "",
    location: "",
    department: "",
    openings: 1,
  },
  roleDetails: {
    overview: "",
    responsibilities: [],
    projects: "",
    techStack: [],
    tools: [],
  },
  skills: {
    mustHave: [],
    goodToHave: [],
    softSkills: [],
  },
  compensation: {
    salaryRange: "",
    stipend: "",
    benefits: [],
  },
  hiringProcess: {
    steps: [],
    mode: "",
    timeline: "",
  },
  timeline: {
    applyBy: "",
    lastDate: "",
    joiningDate: "",
  },
  visibility: "EligibleStudents",
};

const PostJob = () => {
  const [jobData, setJobData] = useState(initialJob);
  const [companyLogoFile, setCompanyLogoFile] = useState(null);
  const [companyLogoPreview, setCompanyLogoPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    return () => {
      if (companyLogoPreview) {
        URL.revokeObjectURL(companyLogoPreview);
      }
    };
  }, [companyLogoPreview]);

  const todayDate = useMemo(() => new Date().toISOString().split("T")[0], []);

  const setValue = (path, value) => {
    setJobData((prev) => {
      const copy = structuredClone(prev);
      let cursor = copy;
      for (let i = 0; i < path.length - 1; i += 1) {
        cursor = cursor[path[i]];
      }
      cursor[path[path.length - 1]] = value;
      return copy;
    });
  };

  const addTag = (path, value) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setJobData((prev) => {
      const copy = structuredClone(prev);
      let cursor = copy;
      for (let i = 0; i < path.length - 1; i += 1) {
        cursor = cursor[path[i]];
      }
      const key = path[path.length - 1];
      if (!cursor[key].includes(trimmed)) {
        cursor[key].push(trimmed);
      }
      return copy;
    });
  };

  const removeTag = (path, value) => {
    setJobData((prev) => {
      const copy = structuredClone(prev);
      let cursor = copy;
      for (let i = 0; i < path.length - 1; i += 1) {
        cursor = cursor[path[i]];
      }
      const key = path[path.length - 1];
      cursor[key] = cursor[key].filter((item) => item !== value);
      return copy;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      await createJob(jobData, companyLogoFile);
      setStatus({
        type: "success",
        message:
          "Job posted successfully. Next step: use Filter Students and send invitation emails for this job.",
      });
      setJobData(initialJob);
      setCompanyLogoFile(null);
      setCompanyLogoPreview("");
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.response?.data?.message || "Failed to create job.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-inner max-w-6xl">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <header className="glass-card p-6 md:p-8">
            <h1 className="section-title">Create Job Posting</h1>
            <p className="muted mt-2">
              Publish a job, then invite shortlisted students by email to unlock
              their application access.
            </p>
          </header>

          <Section title="Job Basics">
            <FormGrid>
              <Input
                label="Job Title"
                value={jobData.jobTitle}
                required
                onChange={(e) => setValue(["jobTitle"], e.target.value)}
              />
              <Input
                label="Company Name"
                value={jobData.company.name}
                required
                onChange={(e) => setValue(["company", "name"], e.target.value)}
              />
            </FormGrid>
            <TextArea
              label="Job Description"
              value={jobData.jobDescription}
              required
              rows={5}
              onChange={(e) => setValue(["jobDescription"], e.target.value)}
            />
          </Section>

          <Section title="Company Information">
            <TextArea
              label="Company Description"
              value={jobData.company.description}
              rows={4}
              onChange={(e) =>
                setValue(["company", "description"], e.target.value)
              }
            />
            <FormGrid>
              <Input
                label="Website"
                value={jobData.company.website}
                onChange={(e) => setValue(["company", "website"], e.target.value)}
              />
              <Input
                label="Industry"
                value={jobData.company.industry}
                onChange={(e) => setValue(["company", "industry"], e.target.value)}
              />
            </FormGrid>

            <div>
              <label className="input-label">Company Logo</label>
              <input
                className="input"
                type="file"
                accept=".jpg,.jpeg,.png"
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
                  className="mt-3 h-16 w-16 rounded-xl border border-white/20 object-cover"
                />
              )}
            </div>
          </Section>

          <Section title="Employment Details">
            <FormGrid columns={3}>
              <Input
                label="Employment Type"
                placeholder="Full-time / Internship"
                value={jobData.employmentDetails.employmentType}
                onChange={(e) =>
                  setValue(["employmentDetails", "employmentType"], e.target.value)
                }
              />
              <Input
                label="Work Mode"
                placeholder="Onsite / Hybrid / Remote"
                value={jobData.employmentDetails.workMode}
                onChange={(e) =>
                  setValue(["employmentDetails", "workMode"], e.target.value)
                }
              />
              <Input
                label="Location"
                value={jobData.employmentDetails.location}
                onChange={(e) =>
                  setValue(["employmentDetails", "location"], e.target.value)
                }
              />
              <Input
                label="Department"
                value={jobData.employmentDetails.department}
                onChange={(e) =>
                  setValue(["employmentDetails", "department"], e.target.value)
                }
              />
              <Input
                label="Openings"
                type="number"
                min={1}
                value={jobData.employmentDetails.openings}
                onChange={(e) =>
                  setValue(
                    ["employmentDetails", "openings"],
                    Number(e.target.value) || 1,
                  )
                }
              />
            </FormGrid>
          </Section>

          <Section title="Role and Skill Set">
            <TextArea
              label="Role Overview"
              value={jobData.roleDetails.overview}
              rows={4}
              onChange={(e) => setValue(["roleDetails", "overview"], e.target.value)}
            />
            <Input
              label="Projects"
              value={jobData.roleDetails.projects}
              onChange={(e) => setValue(["roleDetails", "projects"], e.target.value)}
            />
            <TagInput
              label="Responsibilities"
              tags={jobData.roleDetails.responsibilities}
              onAdd={(value) =>
                addTag(["roleDetails", "responsibilities"], value)
              }
              onRemove={(value) =>
                removeTag(["roleDetails", "responsibilities"], value)
              }
            />
            <TagInput
              label="Tech Stack"
              tags={jobData.roleDetails.techStack}
              onAdd={(value) => addTag(["roleDetails", "techStack"], value)}
              onRemove={(value) => removeTag(["roleDetails", "techStack"], value)}
            />
            <TagInput
              label="Tools"
              tags={jobData.roleDetails.tools}
              onAdd={(value) => addTag(["roleDetails", "tools"], value)}
              onRemove={(value) => removeTag(["roleDetails", "tools"], value)}
            />
            <TagInput
              label="Must Have Skills"
              tags={jobData.skills.mustHave}
              onAdd={(value) => addTag(["skills", "mustHave"], value)}
              onRemove={(value) => removeTag(["skills", "mustHave"], value)}
            />
            <TagInput
              label="Good To Have Skills"
              tags={jobData.skills.goodToHave}
              onAdd={(value) => addTag(["skills", "goodToHave"], value)}
              onRemove={(value) => removeTag(["skills", "goodToHave"], value)}
            />
            <TagInput
              label="Soft Skills"
              tags={jobData.skills.softSkills}
              onAdd={(value) => addTag(["skills", "softSkills"], value)}
              onRemove={(value) => removeTag(["skills", "softSkills"], value)}
            />
          </Section>

          <Section title="Compensation and Hiring">
            <FormGrid>
              <Input
                label="Salary Range"
                value={jobData.compensation.salaryRange}
                onChange={(e) =>
                  setValue(["compensation", "salaryRange"], e.target.value)
                }
              />
              <Input
                label="Stipend"
                value={jobData.compensation.stipend}
                onChange={(e) =>
                  setValue(["compensation", "stipend"], e.target.value)
                }
              />
            </FormGrid>
            <TagInput
              label="Benefits"
              tags={jobData.compensation.benefits}
              onAdd={(value) => addTag(["compensation", "benefits"], value)}
              onRemove={(value) =>
                removeTag(["compensation", "benefits"], value)
              }
            />
            <TagInput
              label="Hiring Steps"
              tags={jobData.hiringProcess.steps}
              onAdd={(value) => addTag(["hiringProcess", "steps"], value)}
              onRemove={(value) => removeTag(["hiringProcess", "steps"], value)}
            />
            <FormGrid>
              <Input
                label="Hiring Mode"
                value={jobData.hiringProcess.mode}
                onChange={(e) => setValue(["hiringProcess", "mode"], e.target.value)}
              />
              <Input
                label="Hiring Timeline"
                value={jobData.hiringProcess.timeline}
                onChange={(e) =>
                  setValue(["hiringProcess", "timeline"], e.target.value)
                }
              />
            </FormGrid>
          </Section>

          <Section title="Important Dates">
            <FormGrid columns={3}>
              <Input
                type="date"
                min={todayDate}
                label="Apply Start Date"
                value={jobData.timeline.applyBy}
                onChange={(e) => setValue(["timeline", "applyBy"], e.target.value)}
              />
              <Input
                type="date"
                min={todayDate}
                required
                label="Last Date to Apply"
                value={jobData.timeline.lastDate}
                onChange={(e) => setValue(["timeline", "lastDate"], e.target.value)}
              />
              <Input
                type="date"
                min={todayDate}
                label="Joining Date"
                value={jobData.timeline.joiningDate}
                onChange={(e) =>
                  setValue(["timeline", "joiningDate"], e.target.value)
                }
              />
            </FormGrid>

            <div>
              <label className="input-label">Visibility</label>
              <select
                className="select"
                value={jobData.visibility}
                onChange={(e) => setValue(["visibility"], e.target.value)}
              >
                <option value="EligibleStudents">Eligible Students Only</option>
                <option value="Public">Public</option>
              </select>
            </div>
          </Section>

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
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Publishing..." : "Publish Job"}
          </motion.button>
        </motion.form>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <motion.section
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.15 }}
    className="glass-card p-6 md:p-8 space-y-5"
  >
    <h2 className="text-lg md:text-xl font-semibold">{title}</h2>
    {children}
  </motion.section>
);

const FormGrid = ({ columns = 2, children }) => (
  <div
    className={
      columns === 3
        ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        : "grid gap-4 sm:grid-cols-2"
    }
  >
    {children}
  </div>
);

const Input = ({ label, ...props }) => (
  <div>
    <label className="input-label">{label}</label>
    <input className="input" {...props} />
  </div>
);

const TextArea = ({ label, ...props }) => (
  <div>
    <label className="input-label">{label}</label>
    <textarea className="textarea" {...props} />
  </div>
);

const TagInput = ({ label, tags, onAdd, onRemove }) => {
  const [draft, setDraft] = useState("");

  const commitTag = () => {
    onAdd(draft);
    setDraft("");
  };

  return (
    <div>
      <label className="input-label">{label}</label>
      <div className="flex gap-2">
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Add ${label.toLowerCase()}`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTag();
            }
          }}
        />
        <button type="button" className="btn-ghost px-4" onClick={commitTag}>
          Add
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onRemove(tag)}
            className="badge hover:opacity-85"
            title="Remove"
          >
            {tag} ✕
          </button>
        ))}
      </div>
    </div>
  );
};

export default PostJob;
