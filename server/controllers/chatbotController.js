import axios from "axios";

import Job from "../models/jobModel.js";
import User from "../models/userModel.js";
import {
  buildActiveJobContext,
  buildExternalJobSuggestions,
  buildStudentProfileContext,
  findRecommendedJobs,
  mergeSkillLists,
} from "../utils/chatbotContextUtils.js";


const CHAT_FALLBACKS = [
  {
    keywords: ["resume", "cv", "ats", "gap"],
    answer:
      "For resume improvement, align your resume with the target role, show measurable impact in projects or internships, and make the strongest tools easy to spot in the top half of the page.",
  },
  {
    keywords: ["interview", "technical", "dsa", "coding"],
    answer:
      "For technical interviews, revise fundamentals first, practice solving problems while explaining your thinking, and prepare project stories that cover design decisions, challenges, and outcomes.",
  },
  {
    keywords: ["hr", "introduction", "strength", "weakness"],
    answer:
      "For HR rounds, keep answers concise, specific, and based on real examples. A short structure of context, action, result, and learning works well.",
  },
  {
    keywords: ["job", "recommend", "placement", "off campus"],
    answer:
      "For job search progress, target roles that already overlap with your current skills, apply consistently, and use each application result to improve one clear gap.",
  },
];


const normalizeHistory = (history) => {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map((item) => {
      const role = typeof item?.role === "string" ? item.role.trim() : "";
      const content =
        typeof item?.content === "string"
          ? item.content.trim()
          : typeof item?.text === "string"
            ? item.text.trim()
            : "";

      if (!role || !content) {
        return null;
      }

      return { role, content };
    })
    .filter(Boolean)
    .slice(-8);
};


const sanitizeResumeAnalysis = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    final_score: Number(value.finalScore ?? value.final_score ?? value.score ?? 0) || 0,
    keyword_score: Number(value.keywordScore ?? value.keyword_score ?? 0) || 0,
    semantic_score: Number(value.semanticScore ?? value.semantic_score ?? 0) || 0,
    resume_skills: Array.isArray(value.resumeSkills ?? value.resume_skills)
      ? value.resumeSkills ?? value.resume_skills
      : [],
    job_skills: Array.isArray(value.jobSkills ?? value.job_skills)
      ? value.jobSkills ?? value.job_skills
      : [],
    matched_skills: Array.isArray(value.matchedSkills ?? value.matched_skills)
      ? value.matchedSkills ?? value.matched_skills
      : [],
    missing_skills: Array.isArray(value.missingSkills ?? value.missing_skills)
      ? value.missingSkills ?? value.missing_skills
      : [],
    skill_gap_percent: Number(
      value.skillGapPercent ?? value.skill_gap_percent ?? 0,
    ) || 0,
    suggestions: Array.isArray(value.suggestions) ? value.suggestions : [],
  };
};


const sanitizeActiveJobSnapshot = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    job_id: String(value.jobId || value.job_id || ""),
    job_title: String(value.jobTitle || value.job_title || "").trim(),
    company: String(value.company || "").trim(),
    description: String(value.description || "").trim(),
    skills: Array.isArray(value.skills) ? value.skills : [],
    location: String(value.location || "").trim(),
    work_mode: String(value.workMode || value.work_mode || "").trim(),
    employment_type: String(
      value.employmentType || value.employment_type || "",
    ).trim(),
  };
};


const buildFallbackAnswer = (question, context) => {
  const lowered = String(question || "").toLowerCase();
  const matched = CHAT_FALLBACKS.find((item) =>
    item.keywords.some((keyword) => lowered.includes(keyword)),
  );

  const resumeAware = Boolean(
    context?.resume_analysis?.resume_skills?.length ||
      context?.student_profile?.skills?.length,
  );
  const jobAware = Boolean(context?.active_job?.job_title);

  if (matched) {
    const extra = [];

    if (resumeAware) {
      extra.push("I also have your resume/profile context available for more specific guidance.");
    }

    if (jobAware) {
      extra.push(`I can tailor the advice to ${context.active_job.job_title}.`);
    }

    return `${matched.answer}${extra.length ? ` ${extra.join(" ")}` : ""}`;
  }

  return (
    "I can help with placement-related questions such as resume improvement, interview preparation, skill-gap planning, and job-search strategy. Ask a specific question and I’ll give a focused answer."
  );
};


const resolveAiChatEndpoint = (baseUrl) => {
  const normalizedBase = String(baseUrl || "")
    .trim()
    .replace(/\/+$/, "");

  if (!normalizedBase) {
    return "http://127.0.0.1:8001/ai/chat";
  }

  if (
    normalizedBase.endsWith("/chat")
    || normalizedBase.endsWith("/ai/chat")
  ) {
    return normalizedBase;
  }

  if (normalizedBase.endsWith("/ai")) {
    return `${normalizedBase}/chat`;
  }

  return `${normalizedBase}/ai/chat`;
};


export const chatWithPlacementAssistant = async (req, res) => {
  const question =
    typeof req.body?.question === "string" ? req.body.question.trim() : "";
  const history = normalizeHistory(req.body?.history);
  const selectedJobId =
    typeof req.body?.selectedJobId === "string"
      ? req.body.selectedJobId.trim()
      : "";
  const resumeAnalysis = sanitizeResumeAnalysis(req.body?.resumeAnalysis);
  const activeJobSnapshot = sanitizeActiveJobSnapshot(req.body?.activeJobSnapshot);

  if (!question) {
    return res.status(400).json({
      success: false,
      message: "Question is required.",
    });
  }

  const aiChatEndpoint = resolveAiChatEndpoint(
    process.env.AI_SERVICE_URL || "http://127.0.0.1:8001",
  );
  let studentProfile = {};
  let activeJobContext = activeJobSnapshot;
  let recommendedJobs = [];
  let externalJobs = [];

  try {
    const user = await User.findById(req.user.id).select(
      "fullname branch cgpa graduationYear placementStatus skills internships projects github linkedin certificates allowed",
    );

    const selectedJob = selectedJobId ? await Job.findById(selectedJobId).lean() : null;
    activeJobContext = selectedJob
      ? buildActiveJobContext(selectedJob)
      : activeJobSnapshot;
    studentProfile = buildStudentProfileContext(user || {}, resumeAnalysis || {});

    const profileSkills = mergeSkillLists(
      studentProfile.skills,
      resumeAnalysis?.resume_skills || [],
      resumeAnalysis?.matched_skills || [],
    );
    const jobSkills = mergeSkillLists(
      activeJobContext?.skills || [],
      resumeAnalysis?.job_skills || [],
    );
    const recommendationSkills = mergeSkillLists(profileSkills, jobSkills);

    recommendedJobs = await findRecommendedJobs(
      recommendationSkills,
      selectedJobId || activeJobContext?.job_id || "",
      {
        studentId: req.user.id,
        studentAllowed: Boolean(user?.allowed),
      },
    );
    externalJobs = buildExternalJobSuggestions({
      baseJobTitle: activeJobContext?.job_title || recommendedJobs[0]?.job_title || "",
      location: activeJobContext?.location || "India",
      resumeSkills: profileSkills,
      jobSkills,
      recommendedJobs,
    });

    const context = {
      student_profile: studentProfile,
      active_job: activeJobContext,
      resume_analysis: resumeAnalysis,
      recommended_jobs: recommendedJobs,
      external_jobs: externalJobs,
    };

    const response = await axios.post(
      aiChatEndpoint,
      {
        question,
        history,
        context,
        resume_skills: profileSkills,
        top_k: 4,
      },
      {
        timeout: 30000,
      },
    );

    return res.json({
      success: true,
      answer: response?.data?.answer || buildFallbackAnswer(question, context),
      intent: response?.data?.intent || "general",
      suggestions: response?.data?.suggestions || [],
      confidence: Number(response?.data?.confidence ?? 0) || 0,
      jobs: response?.data?.jobs || [],
      matchedTopics: response?.data?.matched_topics || [],
      answerMode: response?.data?.answer_mode || "contextual",
      warning: response?.data?.fallback_used
        ? "Knowledge-based fallback response used."
        : "",
      contextFlags: response?.data?.context_flags || {
        resumeAware: Boolean(studentProfile.skills.length || resumeAnalysis),
        jobAware: Boolean(activeJobContext?.job_title),
        recommendationsAttached: recommendedJobs.length > 0 || externalJobs.length > 0,
      },
      skillGap: response?.data?.skill_gap || null,
      recommendedJobs,
      externalJobs,
    });
  } catch (error) {
    const reason =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Unknown AI service error";

    console.warn("Placement assistant fallback triggered:", reason);

    const context = {
      student_profile: studentProfile || {},
      active_job: activeJobContext,
      resume_analysis: resumeAnalysis,
      recommended_jobs: recommendedJobs,
      external_jobs: externalJobs,
    };

    return res.status(200).json({
      success: true,
      answer: buildFallbackAnswer(question, context),
      intent: "general",
      suggestions: [],
      confidence: 0,
      jobs: [],
      matchedTopics: [],
      answerMode: "backend-fallback",
      warning: `AI assistant fallback: ${reason}`,
      contextFlags: {
        resumeAware: Boolean(
          resumeAnalysis?.resume_skills?.length || studentProfile?.skills?.length,
        ),
        jobAware: Boolean(activeJobContext?.job_title),
        recommendationsAttached: recommendedJobs.length > 0 || externalJobs.length > 0,
      },
      skillGap: null,
      recommendedJobs,
      externalJobs,
    });
  }
};
