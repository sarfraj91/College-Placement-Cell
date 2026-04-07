import fs from "fs";
import axios from "axios";
import Job from "../models/jobModel.js";
import { analyzeResume } from "../utils/resumeAnalyzer.js";
import pdfParse from "pdf-parse-new";

const normalizeSkill = (value = "") =>
  String(value).trim().toLowerCase();

const mergeSkillLists = (...collections) => {
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

const mergeSuggestionLists = (...collections) => {
  const seen = new Set();
  const merged = [];

  collections.flat().forEach((item) => {
    const value = String(item || "").trim();
    const normalized = value.toLowerCase();

    if (!value || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    merged.push(value);
  });

  return merged;
};

const slugifyText = (value = "") =>
  normalizeSkill(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const extractJobSkillPool = (job = {}) =>
  mergeSkillLists(
    job?.skills?.mustHave || [],
    job?.skills?.goodToHave || [],
    job?.roleDetails?.techStack || [],
    job?.roleDetails?.tools || []
  );

const formatRecommendedJob = (job, matchedSkills) => ({
  _id: job._id,
  jobTitle: job.jobTitle,
  company: {
    name: job.company?.name || "",
    industry: job.company?.industry || "",
    logo: job.company?.logo || null
  },
  employmentDetails: {
    employmentType: job.employmentDetails?.employmentType || "",
    workMode: job.employmentDetails?.workMode || "",
    location: job.employmentDetails?.location || ""
  },
  timeline: job.timeline || {},
  matchedSkills,
  matchCount: matchedSkills.length
});

const extractLabelValue = (text = "", label) => {
  const pattern = new RegExp(`${label}\\s*[:\\-]\\s*([^\\n.]+)`, "i");
  const match = String(text || "").match(pattern);
  return match?.[1]?.trim() || "";
};

const inferRoleSuggestions = ({ baseJobTitle = "", resumeSkills = [], relatedJobTitles = [] }) => {
  const skillSet = new Set(mergeSkillLists(resumeSkills));
  const roles = [];

  if (baseJobTitle) {
    roles.push(baseJobTitle);
  }

  roles.push(...relatedJobTitles);

  if (skillSet.has("react") && (skillSet.has("node.js") || skillSet.has("express.js"))) {
    roles.push("Full Stack Developer");
    roles.push("MERN Stack Developer");
  }

  if (skillSet.has("react") || (skillSet.has("javascript") && skillSet.has("css"))) {
    roles.push("Frontend Developer");
  }

  if (skillSet.has("node.js") || skillSet.has("express.js") || skillSet.has("fastapi") || skillSet.has("django") || skillSet.has("flask")) {
    roles.push("Backend Developer");
  }

  if (skillSet.has("python") && skillSet.has("machine learning")) {
    roles.push("Machine Learning Engineer");
    roles.push("AI Engineer");
  }

  if (skillSet.has("python")) {
    roles.push("Python Developer");
  }

  if (skillSet.has("java")) {
    roles.push("Java Developer");
  }

  if (
    skillSet.has("sql") &&
    (skillSet.has("excel") || skillSet.has("power bi") || skillSet.has("tableau") || skillSet.has("data analysis"))
  ) {
    roles.push("Data Analyst");
  }

  if (skillSet.has("aws") || skillSet.has("docker") || skillSet.has("kubernetes")) {
    roles.push("DevOps Engineer");
    roles.push("Cloud Engineer");
  }

  if (!roles.length) {
    roles.push("Software Developer");
  }

  return mergeSuggestionLists(roles).slice(0, 5);
};

const buildSearchQuery = (role, skills = []) =>
  [role, ...mergeSkillLists(skills).slice(0, 3)].filter(Boolean).join(" ");

const buildExternalJobSuggestions = ({
  baseJobTitle = "",
  location = "",
  resumeSkills = [],
  jobSkills = [],
  recommendedJobs = []
}) => {
  const relatedJobTitles = recommendedJobs.map((job) => job.jobTitle).filter(Boolean);
  const roles = inferRoleSuggestions({
    baseJobTitle,
    resumeSkills: mergeSkillLists(resumeSkills, jobSkills),
    relatedJobTitles
  });
  const resolvedLocation = location || "India";
  const focusSkills = mergeSkillLists(resumeSkills, jobSkills).slice(0, 4);
  const primaryRole = roles[0] || "Software Developer";
  const secondaryRole = roles[1] || primaryRole;
  const tertiaryRole = roles[2] || primaryRole;

  const externalSources = [
    {
      source: "LinkedIn",
      role: primaryRole,
      applyUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(buildSearchQuery(primaryRole, focusSkills))}&location=${encodeURIComponent(resolvedLocation)}`,
      actionLabel: "Search & Apply on LinkedIn"
    },
    {
      source: "Naukri",
      role: secondaryRole,
      applyUrl: `https://www.naukri.com/${slugifyText(buildSearchQuery(secondaryRole, focusSkills))}-jobs`,
      actionLabel: "Search & Apply on Naukri"
    },
    {
      source: "Unstop",
      role: tertiaryRole,
      applyUrl: `https://unstop.com/jobs?search=${encodeURIComponent(buildSearchQuery(tertiaryRole, focusSkills))}`,
      actionLabel: "Search & Apply on Unstop"
    }
  ];

  return externalSources.map((item) => ({
    ...item,
    location: resolvedLocation,
    matchedSkills: focusSkills,
    searchQuery: buildSearchQuery(item.role, focusSkills),
    description: `Based on your resume and selected role, this source is likely to surface ${item.role} openings you can apply to on the source website.`
  }));
};

const findRecommendedJobs = async (resumeSkills = [], excludedJobId = "") => {
  const normalizedSkills = mergeSkillLists(resumeSkills);

  if (!normalizedSkills.length) {
    return [];
  }

  const skillMatchers = normalizedSkills.map(
    (skill) => new RegExp(`^${escapeRegex(skill)}$`, "i")
  );

  const query = {
    $or: [
      { "skills.mustHave": { $in: skillMatchers } },
      { "skills.goodToHave": { $in: skillMatchers } },
      { "roleDetails.techStack": { $in: skillMatchers } },
      { "roleDetails.tools": { $in: skillMatchers } }
    ]
  };

  if (excludedJobId) {
    query._id = { $ne: excludedJobId };
  }

  const candidateJobs = await Job.find(query)
    .select("jobTitle company employmentDetails skills roleDetails timeline createdAt")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return candidateJobs
    .map((job) => {
      const matchedSkills = normalizedSkills.filter((skill) =>
        extractJobSkillPool(job).includes(skill)
      );

      return formatRecommendedJob(job, matchedSkills);
    })
    .filter((job) => job.matchCount > 0)
    .sort((first, second) => second.matchCount - first.matchCount)
    .slice(0, 5);
};

export const analyzeResumeController = async (req, res) => {
  let uploadPath;
  let selectedListedJob = null;

  try {
    // 1) Validate resume file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Resume file is required"
      });
    }

    uploadPath = req.file.path;

    const jobId = req.body.jobId;
    const customJobDescription = req.body.jobDescription;

    let jobDescription = "";
    let source = "custom";

    // 2) Resolve job description source
    if (jobId) {
      const job = await Job.findById(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found"
        });
      }

      selectedListedJob = job;
      jobDescription = job.description || job.jobDescription || "";
      source = "listed";
    }
    else if (customJobDescription) {
      jobDescription = customJobDescription;
      source = "custom";
    }
    else {
      return res.status(400).json({
        success: false,
        message: "Provide jobId or jobDescription"
      });
    }

    jobDescription = String(jobDescription || "").trim();
    if (!jobDescription) {
      return res.status(400).json({
        success: false,
        message: "Job description is empty"
      });
    }

    // 3) Read resume PDF
    const pdfBuffer = fs.readFileSync(uploadPath);

    const data = await pdfParse(pdfBuffer);
    const resumeText = (data.text || "").trim();

    if (!resumeText) {
      return res.status(400).json({
        success: false,
        message: "Unable to extract text from resume"
      });
    }

    // 4) Keyword / rule-based analyzer
    const keywordResult = analyzeResume(resumeText, jobDescription);
    const keywordScore = Number(keywordResult.score || 0);

    // 5) AI semantic matching
    let aiMatchData = null;
    let semanticScore = 0;
    let aiAvailable = false;

    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || "http://127.0.0.1:8001";
      const aiResponse = await axios.post(
        `${aiServiceUrl}/match`,
        {
          resume_text: resumeText,
          job_description: jobDescription
        },
        {
          timeout: 20000
        }
      );

      aiMatchData = aiResponse?.data || null;
      semanticScore = Number(aiMatchData?.semantic_score || 0);
      aiAvailable = true;
    } catch (aiError) {
      console.warn("AI server not reachable, using keyword score only");
      semanticScore = 0;
    }

    const resumeSkills = mergeSkillLists(
      keywordResult.resumeSkills,
      aiMatchData?.resume_skills,
      keywordResult.matchedSkills
    );

    const jobSkills = mergeSkillLists(
      keywordResult.jobSkills,
      aiMatchData?.job_skills,
      keywordResult.matchedSkills,
      keywordResult.missingSkills
    );

    const matchedSkills = mergeSkillLists(
      keywordResult.matchedSkills,
      aiMatchData?.matched_skills
    );

    const missingSkills = mergeSkillLists(
      keywordResult.missingSkills,
      aiMatchData?.missing_skills
    );

    const skillGapPercent = jobSkills.length > 0
      ? Math.round((missingSkills.length / jobSkills.length) * 100)
      : Number(aiMatchData?.skill_gap_percent || keywordResult.skillGapPercent || 0);

    const suggestions = mergeSuggestionLists(
      keywordResult.suggestions,
      aiMatchData?.suggestions
    );

    // Recommend nearby jobs from the internal catalog using the extracted resume skills.
    const recommendationSkills = mergeSkillLists(resumeSkills, jobSkills, matchedSkills);
    const recommendedJobs = await findRecommendedJobs(recommendationSkills, jobId);
    const baseJobTitle = selectedListedJob?.jobTitle || extractLabelValue(jobDescription, "job title");
    const baseLocation =
      selectedListedJob?.employmentDetails?.location ||
      extractLabelValue(jobDescription, "location") ||
      "India";
    const externalJobs = buildExternalJobSuggestions({
      baseJobTitle,
      location: baseLocation,
      resumeSkills,
      jobSkills,
      recommendedJobs
    });

    const safeKeywordScore = Math.max(0, Math.min(100, keywordScore));
    const safeSemanticScore = Math.max(0, Math.min(100, semanticScore));
    const finalScore = aiAvailable
      ? Math.round((safeKeywordScore * 0.4) + (safeSemanticScore * 0.6))
      : safeKeywordScore;

    // 6) Final response payload
    const result = {
      score: finalScore,
      finalScore,
      keywordScore: safeKeywordScore,
      semanticScore: safeSemanticScore,
      resumeSkills,
      jobSkills,
      matchedSkills,
      missingSkills,
      skillGapPercent,
      suggestions,
      recommendedJobs,
      externalJobs,
      aiAvailable
    };

    return res.json({
      success: true,
      source,
      result
    });
  } catch (error) {
    console.error("Resume analysis error:", error);

    return res.status(500).json({
      success: false,
      message: "Resume analysis failed"
    });

  } finally {
    // 7) Delete uploaded resume temp file
    if (uploadPath && fs.existsSync(uploadPath)) {
      fs.unlinkSync(uploadPath);
    }
  }
};
