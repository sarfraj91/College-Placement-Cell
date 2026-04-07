import Application from "../models/applicationModel.js";
import Job from "../models/jobModel.js";


const SKILL_KEYWORDS = {
  python: ["python"],
  java: ["java"],
  javascript: ["javascript", "js"],
  typescript: ["typescript", "ts"],
  react: ["react", "react.js", "reactjs"],
  "node.js": ["node", "node.js", "nodejs"],
  "express.js": ["express", "express.js", "expressjs"],
  fastapi: ["fastapi", "fast api"],
  django: ["django"],
  flask: ["flask"],
  sql: ["sql"],
  mysql: ["mysql"],
  postgresql: ["postgres", "postgresql"],
  mongodb: ["mongodb", "mongo db"],
  redis: ["redis"],
  docker: ["docker"],
  kubernetes: ["kubernetes", "k8s"],
  aws: ["aws", "amazon web services"],
  azure: ["azure"],
  gcp: ["gcp", "google cloud"],
  html: ["html", "html5"],
  css: ["css", "css3"],
  "tailwind css": ["tailwind", "tailwind css"],
  bootstrap: ["bootstrap"],
  "machine learning": ["machine learning", "ml"],
  "deep learning": ["deep learning"],
  "data analysis": ["data analysis", "data analytics"],
  pandas: ["pandas"],
  numpy: ["numpy"],
  "power bi": ["power bi", "powerbi"],
  tableau: ["tableau"],
  git: ["git", "github"],
  linux: ["linux"],
};


const normalizeSkill = (value = "") => String(value).trim().toLowerCase();


const isPastLastDate = (lastDate) => {
  if (!lastDate) {
    return false;
  }

  const deadline = new Date(lastDate);
  deadline.setHours(23, 59, 59, 999);
  return new Date() > deadline;
};


const isStudentInvitedForJob = (studentId, job) => {
  const eligibleStudentIds = Array.isArray(job?.eligibleStudents)
    ? job.eligibleStudents.map((id) => String(id))
    : [];

  return eligibleStudentIds.includes(String(studentId));
};


export const mergeSkillLists = (...collections) => {
  const seen = new Set();
  const merged = [];

  collections.flat().forEach((item) => {
    const normalized = normalizeSkill(item);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    merged.push(normalized);
  });

  return merged;
};


const splitSkillText = (value = "") =>
  String(value)
    .split(/[\n,;/|]+/)
    .map((item) => normalizeSkill(item))
    .filter(Boolean);


const textContainsAlias = (text = "", aliases = []) =>
  aliases.some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const flexible = escaped.replace(/\s+/g, "\\s+");
    const pattern = new RegExp(`(^|[^\\w])${flexible}($|[^\\w])`, "i");
    return pattern.test(text);
  });


const extractSkillsFromText = (text = "") => {
  const lowered = String(text || "").toLowerCase();

  return Object.entries(SKILL_KEYWORDS)
    .filter(([, aliases]) => textContainsAlias(lowered, aliases))
    .map(([skill]) => skill);
};


const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


const extractJobSkillPool = (job = {}) =>
  mergeSkillLists(
    job?.skills?.mustHave || [],
    job?.skills?.goodToHave || [],
    job?.roleDetails?.techStack || [],
    job?.roleDetails?.tools || [],
  );


const formatRecommendedJob = (job, matchedSkills, status = {}) => ({
  job_id: String(job._id),
  job_title: job.jobTitle,
  company: job.company?.name || "",
  matched_skills: matchedSkills,
  match_count: matchedSkills.length,
  location: job.employmentDetails?.location || "",
  employment_type: job.employmentDetails?.employmentType || "",
  work_mode: job.employmentDetails?.workMode || "",
  source: "internal",
  apply_url: "",
  view_url: `/student/jobs/${job._id}`,
  has_applied: Boolean(status.hasApplied),
  applications_closed: Boolean(status.applicationsClosed),
  can_apply: Boolean(status.canApply),
  is_invited: Boolean(status.isInvited),
  application_status: status.applicationStatus || "",
});


const inferRoleSuggestions = ({
  baseJobTitle = "",
  resumeSkills = [],
  relatedJobTitles = [],
}) => {
  const skillSet = new Set(mergeSkillLists(resumeSkills));
  const roles = [];

  if (baseJobTitle) {
    roles.push(baseJobTitle);
  }

  roles.push(...relatedJobTitles);

  if (skillSet.has("react") && (skillSet.has("node.js") || skillSet.has("express.js"))) {
    roles.push("Full Stack Developer", "MERN Stack Developer");
  }

  if (skillSet.has("react") || (skillSet.has("javascript") && skillSet.has("css"))) {
    roles.push("Frontend Developer");
  }

  if (
    skillSet.has("node.js") ||
    skillSet.has("express.js") ||
    skillSet.has("fastapi") ||
    skillSet.has("django") ||
    skillSet.has("flask")
  ) {
    roles.push("Backend Developer");
  }

  if (skillSet.has("python") && skillSet.has("machine learning")) {
    roles.push("Machine Learning Engineer", "AI Engineer");
  }

  if (skillSet.has("python")) {
    roles.push("Python Developer");
  }

  if (skillSet.has("java")) {
    roles.push("Java Developer");
  }

  if (
    skillSet.has("sql") &&
    (skillSet.has("excel") ||
      skillSet.has("power bi") ||
      skillSet.has("tableau") ||
      skillSet.has("data analysis"))
  ) {
    roles.push("Data Analyst");
  }

  if (skillSet.has("aws") || skillSet.has("docker") || skillSet.has("kubernetes")) {
    roles.push("DevOps Engineer", "Cloud Engineer");
  }

  if (!roles.length) {
    roles.push("Software Developer");
  }

  return mergeSkillLists(roles).slice(0, 5);
};


const buildSearchQuery = (role, skills = []) =>
  [role, ...mergeSkillLists(skills).slice(0, 3)].filter(Boolean).join(" ");


export const buildExternalJobSuggestions = ({
  baseJobTitle = "",
  location = "",
  resumeSkills = [],
  jobSkills = [],
  recommendedJobs = [],
}) => {
  const relatedJobTitles = recommendedJobs.map((job) => job.job_title).filter(Boolean);
  const roles = inferRoleSuggestions({
    baseJobTitle,
    resumeSkills: mergeSkillLists(resumeSkills, jobSkills),
    relatedJobTitles,
  });

  const resolvedLocation = location || "India";
  const focusSkills = mergeSkillLists(resumeSkills, jobSkills).slice(0, 4);
  const primaryRole = roles[0] || "Software Developer";
  const secondaryRole = roles[1] || primaryRole;
  const tertiaryRole = roles[2] || primaryRole;

  return [
    {
      source: "LinkedIn",
      job_title: primaryRole,
      company: "LinkedIn Jobs",
      apply_url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(buildSearchQuery(primaryRole, focusSkills))}&location=${encodeURIComponent(resolvedLocation)}`,
      action_label: "Search & Apply",
    },
    {
      source: "Naukri",
      job_title: secondaryRole,
      company: "Naukri",
      apply_url: `https://www.naukri.com/${buildSearchQuery(secondaryRole, focusSkills).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()}-jobs`,
      action_label: "Search & Apply",
    },
    {
      source: "Unstop",
      job_title: tertiaryRole,
      company: "Unstop",
      apply_url: `https://unstop.com/jobs?search=${encodeURIComponent(buildSearchQuery(tertiaryRole, focusSkills))}`,
      action_label: "Search & Apply",
    },
  ].map((item) => ({
    job_id: "",
    job_title: item.job_title,
    company: item.company,
    matched_skills: focusSkills,
    match_count: focusSkills.length,
    location: resolvedLocation,
    employment_type: "",
    source: item.source,
    apply_url: item.apply_url,
  }));
};


const buildRecommendationStatusMap = async (
  candidateJobs = [],
  { studentId = "", studentAllowed = false } = {},
) => {
  const statusMap = new Map();

  if (!candidateJobs.length) {
    return statusMap;
  }

  const jobIds = candidateJobs.map((job) => job._id);
  let applicationStatusMap = new Map();

  if (studentId) {
    const applications = await Application.find({
      student: studentId,
      job: { $in: jobIds },
    })
      .select("job status")
      .lean();

    applicationStatusMap = new Map(
      applications.map((application) => [
        String(application.job),
        application.status || "applied",
      ]),
    );
  }

  candidateJobs.forEach((job) => {
    const jobId = String(job._id);
    const hasApplied = applicationStatusMap.has(jobId);
    const applicationsClosed = isPastLastDate(job?.timeline?.lastDate);
    const isInvited = studentId
      ? isStudentInvitedForJob(studentId, job)
      : false;
    const canApply = Boolean(
      studentId
        && studentAllowed
        && isInvited
        && !applicationsClosed
        && !hasApplied,
    );

    statusMap.set(jobId, {
      hasApplied,
      applicationsClosed,
      canApply,
      isInvited,
      applicationStatus: applicationStatusMap.get(jobId) || "",
    });
  });

  return statusMap;
};


export const findRecommendedJobs = async (
  skills = [],
  excludedJobId = "",
  options = {},
) => {
  const normalizedSkills = mergeSkillLists(skills);

  if (!normalizedSkills.length) {
    return [];
  }

  const skillMatchers = normalizedSkills.map(
    (skill) => new RegExp(`^${escapeRegex(skill)}$`, "i"),
  );

  const query = {
    $or: [
      { "skills.mustHave": { $in: skillMatchers } },
      { "skills.goodToHave": { $in: skillMatchers } },
      { "roleDetails.techStack": { $in: skillMatchers } },
      { "roleDetails.tools": { $in: skillMatchers } },
    ],
  };

  if (excludedJobId) {
    query._id = { $ne: excludedJobId };
  }

  const candidateJobs = await Job.find(query)
    .select("jobTitle company employmentDetails skills roleDetails timeline eligibleStudents createdAt")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const recommendationStatusMap = await buildRecommendationStatusMap(
    candidateJobs,
    options,
  );

  return candidateJobs
    .map((job) => {
      const matchedSkills = normalizedSkills.filter((skill) =>
        extractJobSkillPool(job).includes(skill),
      );

      return formatRecommendedJob(
        job,
        matchedSkills,
        recommendationStatusMap.get(String(job._id)),
      );
    })
    .filter((job) => job.match_count > 0)
    .sort((first, second) => second.match_count - first.match_count)
    .slice(0, 5);
};


export const buildStudentProfileContext = (user = {}, resumeAnalysis = {}) => {
  const freeformText = [
    user?.skills || "",
    user?.internships || "",
    user?.projects || "",
  ]
    .filter(Boolean)
    .join("\n");

  const explicitSkills = splitSkillText(user?.skills || "");
  const inferredSkills = extractSkillsFromText(freeformText);
  const resumeSkills = Array.isArray(resumeAnalysis?.resumeSkills)
    ? resumeAnalysis.resumeSkills
    : Array.isArray(resumeAnalysis?.resume_skills)
      ? resumeAnalysis.resume_skills
      : [];

  const skills = mergeSkillLists(explicitSkills, inferredSkills, resumeSkills);

  const summaryParts = [
    user?.branch ? `Branch: ${user.branch}` : "",
    user?.cgpa ? `CGPA: ${user.cgpa}` : "",
    user?.graduationYear ? `Graduation Year: ${user.graduationYear}` : "",
    user?.skills ? `Skills: ${user.skills}` : "",
    user?.internships ? `Internships: ${user.internships}` : "",
    user?.projects ? `Projects: ${user.projects}` : "",
  ].filter(Boolean);

  return {
    fullname: user?.fullname || "",
    branch: user?.branch || "",
    cgpa: user?.cgpa || null,
    graduation_year: user?.graduationYear || null,
    placement_status: user?.placementStatus || "",
    skills,
    internships: user?.internships || "",
    projects: user?.projects || "",
    github: user?.github || "",
    linkedin: user?.linkedin || "",
    summary: summaryParts.join("\n"),
    resume_available: Boolean(user?.certificates?.resume?.secure_url),
  };
};


export const buildActiveJobContext = (job = {}) => ({
  job_id: String(job?._id || ""),
  job_title: job?.jobTitle || "",
  company: job?.company?.name || job?.company || "",
  description: job?.jobDescription || job?.description || "",
  skills: extractJobSkillPool(job),
  location: job?.employmentDetails?.location || job?.location || "",
  work_mode: job?.employmentDetails?.workMode || job?.workMode || "",
  employment_type: job?.employmentDetails?.employmentType || job?.employmentType || "",
});
