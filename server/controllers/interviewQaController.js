import crypto from "crypto";
import fs from "fs";

import axios from "axios";
import pdfParse from "pdf-parse-new";

import User from "../models/userModel.js";
import { analyzeResume } from "../utils/resumeAnalyzer.js";
import {
  buildStudentProfileContext,
  mergeSkillLists,
} from "../utils/chatbotContextUtils.js";


const QUESTION_BATCH_SIZE = 10;

const ROLE_ALIASES = {
  frontend: "frontend",
  "front end": "frontend",
  "frontend developer": "frontend",
  backend: "backend",
  "back end": "backend",
  "backend developer": "backend",
  "full stack": "full stack",
  fullstack: "full stack",
  "full stack developer": "full stack",
  "data analyst": "data analyst",
  analyst: "data analyst",
  "data analytics": "data analyst",
  "data analytics intern": "data analyst",
  "business analyst": "data analyst",
  "bi analyst": "data analyst",
  "business intelligence analyst": "data analyst",
};

const DIFFICULTY_ALIASES = {
  easy: "easy",
  medium: "medium",
  moderate: "medium",
  hard: "hard",
  advanced: "hard",
};

const ENGLISH_ALIASES = {
  basic: "basic",
  beginner: "basic",
  simple: "basic",
  medium: "medium",
  intermediate: "medium",
  advanced: "advanced",
  fluent: "advanced",
};

const ROLE_CONTEXT = {
  frontend: {
    label: "Frontend Developer",
    scenario: "a student-facing placement dashboard",
    topics: [
      { label: "React component architecture", questionType: "conceptual" },
      { label: "state management and API integration", questionType: "practical" },
      { label: "performance debugging", questionType: "debugging" },
      { label: "accessibility and responsive UI", questionType: "practical" },
      { label: "testing UI flows", questionType: "practical" },
      { label: "reusable component design", questionType: "conceptual" },
    ],
  },
  backend: {
    label: "Backend Developer",
    scenario: "an AI-powered placement platform",
    topics: [
      { label: "API design and validation", questionType: "conceptual" },
      {
        label: "database schema and query optimization",
        questionType: "practical",
      },
      { label: "authentication and authorization", questionType: "conceptual" },
      { label: "debugging latency issues", questionType: "debugging" },
      { label: "caching and scalability", questionType: "system-design" },
      { label: "async processing and reliability", questionType: "practical" },
    ],
  },
  "full stack": {
    label: "Full Stack Developer",
    scenario: "an end-to-end placement workflow",
    topics: [
      {
        label: "frontend-backend integration",
        questionType: "practical",
      },
      {
        label: "feature design across React and APIs",
        questionType: "system-design",
      },
      { label: "cross-service debugging", questionType: "debugging" },
      { label: "auth and user workflows", questionType: "practical" },
      { label: "delivery tradeoffs", questionType: "conceptual" },
      { label: "testing and monitoring", questionType: "system-design" },
    ],
  },
  "data analyst": {
    label: "Data Analyst",
    scenario: "a reporting and decision-support workflow",
    topics: [
      {
        label: "SQL querying, joins, and data validation",
        questionType: "practical",
      },
      {
        label: "data cleaning and preprocessing",
        questionType: "practical",
      },
      {
        label: "dashboard design and KPI storytelling",
        questionType: "practical",
      },
      {
        label: "exploratory data analysis and trend interpretation",
        questionType: "conceptual",
      },
      {
        label: "stakeholder communication and business recommendations",
        questionType: "behavioral",
      },
      {
        label: "experiment analysis and metric tradeoffs",
        questionType: "debugging",
      },
    ],
  },
};

const ROLE_SIGNAL_KEYWORDS = {
  frontend: [
    "frontend",
    "front end",
    "react",
    "next",
    "next.js",
    "javascript",
    "typescript",
    "html",
    "css",
    "tailwind",
    "redux",
    "ui",
    "ux",
    "responsive",
    "accessibility",
  ],
  backend: [
    "backend",
    "back end",
    "python",
    "fastapi",
    "node",
    "node.js",
    "express",
    "django",
    "flask",
    "java",
    "spring",
    "api",
    "rest",
    "graphql",
    "sql",
    "postgres",
    "mysql",
    "mongodb",
    "redis",
    "jwt",
    "microservice",
  ],
  "data analyst": [
    "data analyst",
    "analytics",
    "analysis",
    "analyst",
    "business intelligence",
    "power bi",
    "tableau",
    "excel",
    "spreadsheet",
    "sql",
    "postgres",
    "mysql",
    "bigquery",
    "snowflake",
    "python",
    "pandas",
    "numpy",
    "statistics",
    "statistical",
    "hypothesis",
    "a/b testing",
    "ab testing",
    "dashboard",
    "visualization",
    "reporting",
    "kpi",
    "metric",
    "etl",
    "data cleaning",
    "data preprocessing",
  ],
};

const RESUME_TOPIC_HINTS = [
  {
    matcher: /power\s*bi|tableau|dashboard|visuali[sz]ation|looker/i,
    label: "dashboard design, KPI storytelling, and visual communication",
    questionType: "practical",
  },
  {
    matcher: /sql|mysql|postgres|bigquery|snowflake|query|join|cte/i,
    label: "SQL querying, aggregations, joins, and data validation",
    questionType: "practical",
  },
  {
    matcher: /python|pandas|numpy|jupyter/i,
    label: "Python-based data cleaning, preprocessing, and analysis",
    questionType: "practical",
  },
  {
    matcher: /excel|pivot|vlookup|xlookup/i,
    label: "Excel-driven analysis, cleaning, and reporting",
    questionType: "practical",
  },
  {
    matcher: /statistics|hypothesis|regression|correlation|significance|a\/b|ab test/i,
    label: "statistical reasoning, experiment analysis, and interpreting significance",
    questionType: "conceptual",
  },
  {
    matcher: /etl|pipeline|warehouse|data quality|ingestion/i,
    label: "data pipelines, ETL workflows, and quality checks",
    questionType: "system-design",
  },
  {
    matcher: /stakeholder|business|recommendation|insight|kpi|metric/i,
    label: "translating analysis into business recommendations and KPI decisions",
    questionType: "behavioral",
  },
  {
    matcher: /react|next|ui|ux|tailwind|css/i,
    label: "building responsive UI flows and reusable components",
    questionType: "practical",
  },
  {
    matcher: /node|express|django|flask|api|rest|graphql/i,
    label: "API design, integration, and debugging service flows",
    questionType: "practical",
  },
];

const QUESTION_PATTERNS = {
  easy: [
    "Explain the core idea behind {topic} for {scenario}.",
    "How would you implement {topic} step by step in {scenario}?",
    "What common mistakes would you avoid while working on {topic}?",
    "How would your experience with {skillFocus} help you handle {topic}?",
    "Pick one of your projects and explain how {topic} showed up in real work.",
    "What practical example would you use to explain {topic} in an interview?",
  ],
  medium: [
    "How would you design {topic} for {scenario} while keeping the code maintainable?",
    "Walk me through a practical implementation of {topic}, including tradeoffs.",
    "Suppose {topic} caused bugs in production. How would you debug it?",
    "Based on your experience with {skillFocus}, what best practices would you follow for {topic}?",
    "How would you explain {topic} using a project example?",
    "If requirements changed midway, how would you adapt your approach to {topic}?",
  ],
  hard: [
    "Design a production-ready approach for {topic} in {scenario}. What tradeoffs would you make?",
    "How would you scale or harden {topic} when usage grows quickly?",
    "Imagine your first solution for {topic} failed in production. How would you redesign it?",
    "Using your background in {skillFocus}, what advanced decisions matter most for {topic}?",
    "How would you justify your architectural choices for {topic} to senior engineers?",
    "Tell me about a project example where {topic} would require balancing performance, reliability, and developer velocity.",
  ],
};

const toCleanString = (value) =>
  typeof value === "string" ? value.trim() : "";

const toCleanList = (value) => {
  if (!value) return [];

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return [...new Set(parsed.map((item) => toCleanString(item)).filter(Boolean))];
        }
      } catch {
        // Fall back to text splitting below.
      }
    }
  }

  const source = Array.isArray(value)
    ? value
    : String(value).split(/[\n,;/|]+/);

  const cleaned = source
    .map((item) => toCleanString(String(item)))
    .filter(Boolean);

  return [...new Set(cleaned)];
};

const normalizeRole = (value) =>
  ROLE_ALIASES[toCleanString(value).toLowerCase()] || "full stack";

const normalizeDifficulty = (value) =>
  DIFFICULTY_ALIASES[toCleanString(value).toLowerCase()] || "medium";

const normalizeEnglishLevel = (value) =>
  ENGLISH_ALIASES[toCleanString(value).toLowerCase()] || "medium";

const dedupeTopicEntries = (entries = []) => {
  const seen = new Set();

  return entries.filter((entry) => {
    const label = toCleanString(entry?.label).toLowerCase();

    if (!label || seen.has(label)) {
      return false;
    }

    seen.add(label);
    return true;
  });
};

const topicFromSkill = (skill = "") => {
  const normalizedSkill = toCleanString(skill);
  const lowerSkill = normalizedSkill.toLowerCase();

  if (!lowerSkill) {
    return null;
  }

  if (/power\s*bi|tableau|looker/.test(lowerSkill)) {
    return {
      label: `using ${normalizedSkill} to design dashboards and explain KPIs`,
      questionType: "practical",
    };
  }

  if (/sql|mysql|postgres|bigquery|snowflake/.test(lowerSkill)) {
    return {
      label: `using ${normalizedSkill} for querying, joins, and data validation`,
      questionType: "practical",
    };
  }

  if (/python|pandas|numpy|jupyter/.test(lowerSkill)) {
    return {
      label: `using ${normalizedSkill} for data cleaning and analysis`,
      questionType: "practical",
    };
  }

  if (/excel|spreadsheet|pivot/.test(lowerSkill)) {
    return {
      label: `using ${normalizedSkill} for reporting, cleaning, and ad hoc analysis`,
      questionType: "practical",
    };
  }

  if (/statistics|regression|correlation|hypothesis|a\/b/.test(lowerSkill)) {
    return {
      label: `applying ${normalizedSkill} to make reliable data decisions`,
      questionType: "conceptual",
    };
  }

  if (/react|next|tailwind|typescript|javascript/.test(lowerSkill)) {
    return {
      label: `applying ${normalizedSkill} to build polished user experiences`,
      questionType: "practical",
    };
  }

  if (/node|express|django|flask|fastapi|api/.test(lowerSkill)) {
    return {
      label: `applying ${normalizedSkill} to build and debug backend workflows`,
      questionType: "practical",
    };
  }

  return null;
};

const normalizeQuestionCount = (
  value,
  { min = 3, max = 8, fallback = 5 } = {},
) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
};

const toCleanObjectList = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === "object");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item) => item && typeof item === "object")
        : [];
    } catch {
      return [];
    }
  }

  return [];
};

const resolveAiEndpoint = (baseUrl, endpointName) => {
  const normalizedBase = String(baseUrl || "")
    .trim()
    .replace(/\/+$/, "");

  if (!normalizedBase) {
    return `http://127.0.0.1:8001/ai/${endpointName}`;
  }

  if (normalizedBase.endsWith(`/ai/${endpointName}`)) {
    return normalizedBase;
  }

  if (normalizedBase.endsWith("/ai")) {
    return `${normalizedBase}/${endpointName}`;
  }

  return `${normalizedBase}/ai/${endpointName}`;
};

const questionId = (question) =>
  crypto.createHash("md5").update(question).digest("hex").slice(0, 12);

const normalizeQuestionKey = (question = "") =>
  toCleanString(question).toLowerCase().replace(/\s+/g, " ");

const trimSentence = (value = "", maxLength = 180) => {
  const cleaned = toCleanString(value).replace(/\s+/g, " ");
  if (!cleaned) {
    return "";
  }

  const firstSentence =
    cleaned.split(/(?<=[.!?])\s+/)[0]?.trim() || cleaned.slice(0, maxLength).trim();

  return firstSentence.length > maxLength
    ? `${firstSentence.slice(0, maxLength).trim()}...`
    : firstSentence;
};

const looksLikeAnswerGuidance = (answer = "") => {
  const normalized = toCleanString(answer).toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    /^(i would answer|i would start|i would frame|you should answer|you can answer|a strong answer|start with|begin with|for a harder version)/.test(
      normalized,
    ) ||
    (normalized.match(/\bi would\b/g) || []).length >= 2
  );
};

const deleteUploadIfExists = (uploadPath = "") => {
  if (uploadPath && fs.existsSync(uploadPath)) {
    fs.unlinkSync(uploadPath);
  }
};

const buildResumeSummary = (resumeText = "", resumeSkills = []) => {
  const primaryLines = String(resumeText || "")
    .split(/\r?\n/)
    .map((line) => toCleanString(line))
    .filter(Boolean)
    .slice(0, 8);

  const summary = primaryLines.join(" ").slice(0, 900).trim();
  const skillLine = resumeSkills.length
    ? ` Key skills from resume: ${resumeSkills.slice(0, 8).join(", ")}.`
    : "";

  return `${summary || "Resume uploaded successfully."}${skillLine}`.trim();
};

const extractResumeContext = async (file) => {
  if (!file?.path) {
    return {
      resumeText: "",
      resumeSummary: "",
      resumeSkills: [],
      resumeFilename: "",
    };
  }

  const pdfBuffer = fs.readFileSync(file.path);
  const parsed = await pdfParse(pdfBuffer);
  const resumeText = toCleanString(parsed?.text);

  if (!resumeText) {
    throw new Error("Unable to extract text from the uploaded resume.");
  }

  const resumeInsights = analyzeResume(resumeText, "");
  const resumeSkills = toCleanList(resumeInsights?.resumeSkills || []);

  return {
    resumeText,
    resumeSummary: buildResumeSummary(resumeText, resumeSkills),
    resumeSkills,
    resumeFilename: toCleanString(file.originalname),
  };
};

const buildExperienceSummary = (user = {}, studentProfile = {}) => {
  const parts = [
    user?.branch ? `Branch: ${user.branch}` : "",
    user?.cgpa ? `CGPA: ${user.cgpa}` : "",
    user?.graduationYear ? `Graduation year: ${user.graduationYear}` : "",
    user?.placementStatus ? `Placement status: ${user.placementStatus}` : "",
    studentProfile?.internships ? `Internships: ${studentProfile.internships}` : "",
  ].filter(Boolean);

  return parts.join(". ");
};

const buildInterviewProfile = async (userId, body = {}) => {
  const user = await User.findById(userId)
    .select(
      "fullname branch cgpa graduationYear placementStatus skills internships projects github linkedin certificates",
    )
    .lean();

  const studentProfile = buildStudentProfileContext(user || {}, {});
  const requestSkills = toCleanList(body.skills);
  const resumeSkills = toCleanList(body.resumeSkills || body.resume_skills);
  const resumeSummary = toCleanString(body.resumeSummary || body.resume_summary);
  const skills = mergeSkillLists(
    studentProfile.skills || [],
    requestSkills,
    resumeSkills,
  ).slice(0, 10);
  const projects = toCleanString(body.projects || studentProfile.projects);
  const experience = toCleanString(
    body.experience || buildExperienceSummary(user || {}, studentProfile),
  );
  const summary = [
    toCleanString(studentProfile.summary || ""),
    resumeSummary,
  ]
    .filter(Boolean)
    .join(". ");

  return {
    studentProfile,
    skills,
    resumeSkills,
    resumeSummary,
    projects,
    experience,
    summary: toCleanString(summary),
  };
};

const countRoleKeywordMatches = (text, keywords = []) =>
  keywords.reduce(
    (total, keyword) => (text.includes(keyword) ? total + 1 : total),
    0,
  );

const buildResumeTopicPool = ({
  role,
  skills = [],
  resumeSkills = [],
  projects = "",
  experience = "",
  resumeSummary = "",
  resumeText = "",
}) => {
  const textCorpus = [
    projects,
    experience,
    resumeSummary,
    String(resumeText || "").slice(0, 2800),
  ]
    .map((item) => toCleanString(item))
    .filter(Boolean)
    .join(" ");

  const roleTopics = (ROLE_CONTEXT[role]?.topics || []).map((entry) => ({
    label: toCleanString(entry?.label || entry),
    questionType: toCleanString(entry?.questionType) || "conceptual",
  }));

  const hintedTopics = RESUME_TOPIC_HINTS.filter(({ matcher }) =>
    matcher.test(textCorpus),
  ).map(({ label, questionType }) => ({
    label,
    questionType,
  }));

  const skillTopics = [...skills, ...resumeSkills]
    .map((item) => topicFromSkill(item))
    .filter(Boolean);

  return dedupeTopicEntries([...hintedTopics, ...skillTopics, ...roleTopics]).slice(
    0,
    12,
  );
};

const inferInterviewRole = ({
  skills = [],
  resumeSkills = [],
  projects = "",
  experience = "",
  summary = "",
  resumeSummary = "",
  resumeText = "",
} = {}) => {
  const normalizedSkills = [...skills, ...resumeSkills]
    .map((item) => toCleanString(item).toLowerCase())
    .filter(Boolean);
  const textCorpus = [
    projects,
    experience,
    summary,
    resumeSummary,
    String(resumeText || "").slice(0, 2500),
  ]
    .map((item) => toCleanString(item).toLowerCase())
    .join(" ");

  const explicitFullStack =
    /full\s*stack|fullstack|mern|mean/.test(textCorpus) ||
    normalizedSkills.some((skill) =>
      ["full stack", "fullstack", "mern", "mean"].some((token) =>
        skill.includes(token),
      ),
    );
  const explicitDataAnalyst =
    /data\s+analyst|analytics?\s+intern|business\s+intelligence|bi\s+analyst|reporting\s+analyst/.test(
      textCorpus,
    ) ||
    normalizedSkills.some((skill) =>
      [
        "data analyst",
        "analytics",
        "power bi",
        "tableau",
        "business intelligence",
      ].some((token) => skill.includes(token)),
    );

  const frontendSkillHits = normalizedSkills.filter((skill) =>
    ROLE_SIGNAL_KEYWORDS.frontend.some((keyword) => skill.includes(keyword)),
  ).length;
  const backendSkillHits = normalizedSkills.filter((skill) =>
    ROLE_SIGNAL_KEYWORDS.backend.some((keyword) => skill.includes(keyword)),
  ).length;
  const dataAnalystSkillHits = normalizedSkills.filter((skill) =>
    ROLE_SIGNAL_KEYWORDS["data analyst"].some((keyword) => skill.includes(keyword)),
  ).length;

  const frontendScore =
    frontendSkillHits * 3 +
    countRoleKeywordMatches(textCorpus, ROLE_SIGNAL_KEYWORDS.frontend);
  const backendScore =
    backendSkillHits * 3 +
    countRoleKeywordMatches(textCorpus, ROLE_SIGNAL_KEYWORDS.backend);
  const dataAnalystScore =
    dataAnalystSkillHits * 3 +
    countRoleKeywordMatches(textCorpus, ROLE_SIGNAL_KEYWORDS["data analyst"]) +
    (explicitDataAnalyst ? 5 : 0);

  if (
    explicitDataAnalyst &&
    dataAnalystScore >= Math.max(frontendScore, backendScore)
  ) {
    return "data analyst";
  }

  if (
    explicitFullStack ||
    (frontendScore >= 4 && backendScore >= 4) ||
    (frontendScore + backendScore >= 6 &&
      Math.abs(frontendScore - backendScore) <= 1)
  ) {
    return "full stack";
  }

  if (
    dataAnalystScore > 0 &&
    dataAnalystScore >= frontendScore + 2 &&
    dataAnalystScore >= backendScore + 2
  ) {
    return "data analyst";
  }

  if (frontendScore === 0 && backendScore === 0 && dataAnalystScore === 0) {
    return "full stack";
  }

  return frontendScore > backendScore ? "frontend" : "backend";
};

const resolveInterviewRole = ({
  requestedRole,
  profile,
  resumeContext = {},
}) => {
  const cleanedRequestedRole = toCleanString(requestedRole).toLowerCase();

  if (cleanedRequestedRole && cleanedRequestedRole !== "auto") {
    return normalizeRole(cleanedRequestedRole);
  }

  return inferInterviewRole({
    skills: profile?.skills || [],
    resumeSkills: profile?.resumeSkills || resumeContext?.resumeSkills || [],
    projects: profile?.projects || "",
    experience: profile?.experience || "",
    summary: profile?.summary || "",
    resumeSummary: profile?.resumeSummary || resumeContext?.resumeSummary || "",
    resumeText: resumeContext?.resumeText || "",
  });
};

const buildFallbackQuestions = ({
  role,
  difficulty,
  skills,
  resumeSkills = [],
  projects,
  experience,
  resumeSummary,
  resumeText,
  excludeQuestions = [],
}) => {
  const context = ROLE_CONTEXT[role];
  const patterns = QUESTION_PATTERNS[difficulty];
  const scenario = context.scenario;
  const skillFocus = skills.slice(0, 3).join(", ") || "role-relevant skills";
  const excluded = new Set(excludeQuestions.map((item) => item.toLowerCase()));
  const questions = [];
  const topicPool = buildResumeTopicPool({
    role,
    skills,
    resumeSkills,
    projects,
    experience,
    resumeSummary,
    resumeText,
  });
  const templateOffset = excludeQuestions.length % patterns.length;

  const buildQuestionSupport = ({
    focusArea,
    questionType,
    personalization,
  }) => {
    const normalizedType = toCleanString(questionType).toLowerCase();

    if (normalizedType === "behavioral") {
      return {
        interviewerIntent:
          `Checks how clearly you communicate ownership, judgment, and outcomes around ${focusArea}.`,
        strongSignals: [
          "Use a compact STAR flow with clear ownership.",
          "Mention a real challenge, decision, and result.",
          "Close with what changed or what you learned.",
          personalization,
        ].filter(Boolean),
        redFlags: [
          "Giving a team story without saying what you personally owned.",
          "Staying generic instead of using a real example.",
          "Ending without a result, learning, or impact.",
        ],
      };
    }

    if (normalizedType === "debugging") {
      return {
        interviewerIntent:
          `Tests how you break down issues, verify root causes, and recover from failures in ${focusArea}.`,
        strongSignals: [
          "Explain the symptom, root-cause path, and fix.",
          "Mention the data, logs, or checks you used.",
          "Show how you prevented the issue from repeating.",
          personalization,
        ].filter(Boolean),
        redFlags: [
          "Jumping to the fix without showing diagnosis.",
          "Giving a theoretical answer with no real incident.",
          "Skipping validation after the fix.",
        ],
      };
    }

    if (normalizedType === "system-design") {
      return {
        interviewerIntent:
          `Explores how well you reason about architecture, tradeoffs, and scale in ${focusArea}.`,
        strongSignals: [
          "Start with goal, constraints, and key components.",
          "Call out tradeoffs in performance, reliability, and maintainability.",
          "Mention how you would validate or monitor the design.",
          personalization,
        ].filter(Boolean),
        redFlags: [
          "Listing tools without explaining why they fit.",
          "Skipping tradeoffs or failure cases.",
          "Sounding too broad for the actual resume context.",
        ],
      };
    }

    return {
      interviewerIntent:
        `Checks whether you can explain ${focusArea} in a practical, resume-grounded way.`,
      strongSignals: [
        "Use one resume-backed example quickly.",
        "Explain one decision and why you made it.",
        "Finish with a result, validation step, or tradeoff.",
        personalization,
      ].filter(Boolean),
      redFlags: [
        "Giving a textbook answer that ignores your own work.",
        "Listing steps without reasoning or outcomes.",
        "Over-claiming experience the resume does not support.",
      ],
    };
  };

  topicPool.forEach((topicEntry, index) => {
    patterns.forEach((template, templateIndex) => {
      if (questions.length >= QUESTION_BATCH_SIZE) {
        return;
      }

      const templateToUse =
        patterns[(templateIndex + templateOffset + index) % patterns.length];
      const topic = topicEntry.label;

      let question = templateToUse
        .replaceAll("{topic}", topic)
        .replaceAll("{scenario}", scenario)
        .replaceAll("{skillFocus}", skillFocus);

      if (question.toLowerCase().includes("project") && !projects) {
        question = `How would you explain a practical example of ${topic} in work that resembles ${scenario}?`;
      }

      if (excluded.has(question.toLowerCase())) {
        return;
      }

      excluded.add(question.toLowerCase());
      const questionType =
        topicEntry.questionType ||
        ((index + templateIndex) % 3 === 0
          ? "conceptual"
          : (index + templateIndex) % 3 === 1
            ? "practical"
            : "debugging");
      const personalization = `Built to match your target role and background in ${skillFocus}.`;
      const questionSupport = buildQuestionSupport({
        focusArea: topic,
        questionType,
        personalization,
      });

      questions.push({
        id: questionId(question),
        question,
        focusArea: topic,
        questionType,
        difficulty,
        role,
        personalization,
        interviewerIntent: questionSupport.interviewerIntent,
        strongSignals: questionSupport.strongSignals,
        redFlags: questionSupport.redFlags,
      });
    });
  });

  return questions;
};

const buildFallbackAnswer = ({
  question,
  role,
  skills,
  projects,
  difficulty,
  experience,
  resumeSummary,
  resumeText,
  focusArea,
  questionType,
  personalization,
  previousAnswers = [],
}) => {
  const skillFocus = skills.slice(0, 4).join(", ") || "role-relevant fundamentals";
  const projectHint =
    trimSentence(projects) ||
    trimSentence(resumeSummary) ||
    trimSentence(resumeText, 220) ||
    "a recent academic or personal project";
  const focusHint = toCleanString(focusArea) || "this topic";
  const questionTypeHint = toCleanString(questionType).toLowerCase();
  const personalizationHint = toCleanString(personalization);
  const refreshVariant = previousAnswers.length > 0;
  let answer =
    `In one of my projects, ${focusHint} came up while I was working on ${projectHint}. ` +
    `I handled it by using ${skillFocus} in a practical way instead of keeping the solution theoretical. ` +
    "I first clarified the goal, then implemented the approach step by step, and validated it with output checks, testing, or data verification depending on the task. " +
    "The key point I would emphasize is the decision I made, why that choice fit the problem, and what tradeoff I had to manage to keep the result reliable.";

  if (questionTypeHint === "behavioral") {
    answer =
      `A good example from my background is work around ${projectHint}. ` +
      `In that situation, I personally owned the part related to ${focusHint} and used ${skillFocus} to move it forward. ` +
      "The challenge was balancing correctness with speed, so I focused on one clear decision, explained why I made it, and then showed the outcome. " +
      "I would close by mentioning the measurable result or the lesson I carried into the next project.";
  } else if (difficulty === "hard") {
    answer =
      `In my experience, ${focusHint} becomes important when the system has to stay reliable under change and scale. ` +
      `In work connected to ${projectHint}, I would explain that I started by defining the constraints and then used ${skillFocus} to build a solution that stayed maintainable. ` +
      "The strongest part of the answer would be the tradeoff discussion, because I could compare speed, reliability, and complexity instead of pretending every option was equally good. " +
      "I would also mention how I validated the result and what I would revisit if the workload or product scope increased.";
  }

  if (refreshVariant) {
    answer =
      `${answer} ` +
      "For a stronger second version, I would make the example more concrete by naming one implementation detail, one validation step, and one improvement I would make next.";
  }

  return {
    answer,
    highlights: [
      "Start with the goal and context.",
      "Use a concrete example from your projects or resume.",
      "Explain the decision, validation, and tradeoff.",
      personalizationHint || "",
    ],
    answerFramework: [
      questionTypeHint === "behavioral"
        ? "Situation and responsibility"
        : "Goal and context",
      questionTypeHint === "behavioral"
        ? "Actions you personally took"
        : "Implementation approach",
      questionTypeHint === "behavioral"
        ? "Decision or challenge"
        : "Project example",
      questionTypeHint === "behavioral"
        ? "Result or learning"
        : "Validation and tradeoff",
    ].filter(Boolean),
    answerHook:
      questionTypeHint === "behavioral"
        ? "Open with the situation and your specific responsibility before moving into action."
        : difficulty === "hard"
          ? "Lead with the goal and constraints before describing your design choice."
          : "Start with the problem or goal, then move quickly into your own contribution.",
    deliveryTips:
      questionTypeHint === "behavioral"
        ? [
            "Keep the story compact and focused on one situation.",
            "Say what you personally did, not just what the team did.",
            "End with the result or lesson you took forward.",
          ]
        : difficulty === "hard"
          ? [
              "Name the tradeoff you optimized for and why.",
              "Use one concrete example to stop the answer sounding abstract.",
              "Mention validation, monitoring, or failure handling.",
            ]
          : [
              "Keep the answer in first person and make ownership explicit.",
              "Use one real example before moving into theory.",
              "Finish with a result, validation step, or tradeoff.",
            ],
    pitfalls:
      questionTypeHint === "behavioral"
        ? [
            "Do not spend too long setting up the background.",
            "Do not tell a team story without clarifying your role.",
            "Do not forget the result or learning.",
          ]
        : difficulty === "hard"
          ? [
              "Do not list architecture terms without justification.",
              "Do not ignore scale, reliability, or maintainability.",
              "Do not forget to mention how you would validate the solution.",
            ]
          : [
              "Do not give a generic textbook explanation with no project context.",
              "Do not skip the reason behind your decisions.",
              "Do not claim production ownership the resume does not support.",
            ],
  };
};

const buildFallbackEvaluation = ({ userAnswer, role }) => {
  const answerText = toCleanString(userAnswer);
  const strengths = [];
  const weaknesses = [];
  const answerLength = answerText.split(/\s+/).filter(Boolean).length;

  if (answerLength >= 60) {
    strengths.push("Your answer has enough detail to sound thoughtful rather than rushed.");
  } else {
    weaknesses.push("Your answer is short, so it may feel underdeveloped in a real interview.");
  }

  if (/\b(i|my|we)\b/i.test(answerText)) {
    strengths.push("You use ownership language, which makes the answer feel authentic.");
  } else {
    weaknesses.push("Add first-person ownership so the interviewer knows what you personally did.");
  }

  if (/\b(example|project|built|used|implemented)\b/i.test(answerText)) {
    strengths.push("You reference practical work, which makes the answer more believable.");
  } else {
    weaknesses.push("Include a project or implementation example to support your explanation.");
  }

  if (!/\b(tradeoff|impact|result|performance|scale|latency|because)\b/i.test(answerText)) {
    weaknesses.push("Add reasoning, impact, or tradeoff language so the answer sounds more senior.");
  }

  const score = answerLength < 40 ? 48 : answerLength > 110 ? 82 : 72;

  return {
    strengths: strengths.slice(0, 3).length
      ? strengths.slice(0, 3)
      : ["Your answer addresses the question directly, which is a solid start."],
    weaknesses: weaknesses.slice(0, 3).length
      ? weaknesses.slice(0, 3)
      : ["Improve structure slightly so the answer flows from problem to implementation to outcome."],
    improvedAnswer:
      `A stronger ${ROLE_CONTEXT[role].label} answer would start by stating the goal and constraints clearly, then explain the implementation approach in steps, ` +
      "and finally tie it to a real project outcome. Mention what you built, why you chose that approach, how you validated it, and one tradeoff you would revisit if the system became more complex.",
    verdict:
      score < 80
        ? "Promising answer with clear room to become more specific and example-driven."
        : "Strong answer that sounds practical and interview-ready.",
    score,
    improvementPlan: [
      "Make your opening clearer and more direct.",
      "Add one stronger project example with your personal ownership.",
      "Finish with outcome, tradeoff, or validation.",
    ],
  };
};

const buildFallbackFollowUp = ({ question, role }) => {
  const loweredQuestion = toCleanString(question).toLowerCase();

  if (role === "frontend" || /react|ui|frontend|accessibility/.test(loweredQuestion)) {
    return {
      followUpQuestion:
        "How would you measure whether that frontend decision actually improved performance, accessibility, and user experience in production?",
      reason: "Pushes deeper on validation, metrics, and real-world frontend tradeoffs.",
      whatToCover: [
        "Use a concrete product or UI example.",
        "Explain the metric, feedback loop, or validation method.",
        "Mention what tradeoff you made and why.",
      ],
    };
  }

  if (role === "backend" || /api|database|backend|cache|latency/.test(loweredQuestion)) {
    return {
      followUpQuestion:
        "If traffic increased 10x after launch, what would you change first in the API, database, and monitoring strategy?",
      reason: "Explores scale, reliability, and operational thinking.",
      whatToCover: [
        "Name the bottleneck you would inspect first.",
        "Explain the system or data tradeoff behind the change.",
        "Mention how you would monitor or validate improvement.",
      ],
    };
  }

  return {
    followUpQuestion:
      "What tradeoff would you revisit first if this solution had to support more users, faster iteration, and stricter reliability requirements?",
    reason: "Moves the discussion from implementation to senior-level tradeoff thinking.",
    whatToCover: [
      "Use one concrete example instead of a generic explanation.",
      "Explain the tradeoff or decision behind your answer.",
      "Mention how you measured, validated, or improved the result.",
    ],
  };
};

const normalizeMockInterviewHistory = (value) =>
  toCleanObjectList(value)
    .map((item) => ({
      question: toCleanString(item.question || item.currentQuestion),
      answer: toCleanString(item.answer || item.userAnswer),
      interviewerReply: toCleanString(
        item.interviewerReply || item.interviewer_reply,
      ),
    }))
    .filter((item) => item.question);

const buildMockInterviewOpening = ({ englishLevel, totalQuestions }) => {
  if (englishLevel === "basic") {
    return (
      `Hi, welcome. I reviewed your resume and we will go through ${totalQuestions} questions. ` +
      "Please answer in simple, honest English with real examples."
    );
  }

  if (englishLevel === "advanced") {
    return (
      `Thanks for joining. I reviewed your resume and we will work through ${totalQuestions} realistic questions ` +
      "with deeper follow-ups around your decisions, tradeoffs, and impact."
    );
  }

  return (
    `Thanks for joining. I reviewed your resume and we will work through ${totalQuestions} realistic questions. ` +
    "Answer naturally and use examples from your own work whenever possible."
  );
};

const buildMockInterviewReply = ({ userAnswer, englishLevel }) => {
  const answerText = toCleanString(userAnswer);
  const answerLength = answerText.split(/\s+/).filter(Boolean).length;
  const hasExample = /\b(example|project|built|implemented|used)\b/i.test(answerText);
  const hasReasoning =
    /\b(because|tradeoff|impact|result|performance|scale|latency)\b/i.test(answerText);

  if (answerLength < 25) {
    return englishLevel === "basic"
      ? "Thanks. Please give me a little more detail and one clear example."
      : "Thanks. That is a start, but I would like a more detailed and concrete answer.";
  }

  if (hasExample && hasReasoning) {
    return englishLevel === "basic"
      ? "Good. I can see your example. Let me ask one deeper question."
      : "That gives me a useful picture of your thinking. Let me push a little deeper on that.";
  }

  if (hasExample) {
    return englishLevel === "basic"
      ? "Thanks, your example helps. Now I want to know why you chose that approach."
      : "Thanks, the example helps. I want to understand your decision-making more clearly.";
  }

  return englishLevel === "basic"
    ? "I understand. Now tell me one real situation where you did this."
    : "I understand the direction. Now I want to hear a more specific scenario from your experience.";
};

const buildMockInterviewStartFallback = ({
  role,
  difficulty,
  englishLevel,
  totalQuestions,
  skills,
  projects,
}) => {
  const [firstQuestion] = buildFallbackQuestions({
    role,
    difficulty,
    skills,
    projects,
    excludeQuestions: [],
  });

  return {
    opening: buildMockInterviewOpening({ englishLevel, totalQuestions }),
    question:
      firstQuestion?.question ||
      "Tell me about a project from your resume and the most important technical decision you made.",
    interviewerStyle:
      englishLevel === "advanced"
        ? "polished and challenging interviewer tone"
        : englishLevel === "basic"
          ? "clear and supportive interviewer tone"
          : "natural and professional interviewer tone",
    candidateBrief:
      "Expect a realistic flow with project depth, decision-making, and communication checks.",
    focusAreas: [role, "project depth", "decision-making"],
  };
};

const buildMockInterviewTurnFallback = ({
  currentQuestion,
  userAnswer,
  role,
  difficulty,
  englishLevel,
  questionIndex,
  totalQuestions,
  skills,
  projects,
  history,
}) => {
  if (questionIndex >= totalQuestions) {
    return {
      interviewerReply: buildMockInterviewReply({ userAnswer, englishLevel }),
      question: "",
      shouldEnd: true,
      closingRemark:
        englishLevel === "basic"
          ? "Thanks, that is the end of the interview. I appreciate your effort."
          : "Thanks, that wraps up the interview. I appreciate the way you stayed with the discussion.",
      focusArea: "closing",
      answerSignal: "You completed the planned interview flow.",
      coachingTip:
        "Review your last answer and note one place where you could add clearer ownership or outcome.",
    };
  }

  const askedQuestions = new Set(
    history
      .map((item) => toCleanString(item.question).toLowerCase())
      .filter(Boolean),
  );
  askedQuestions.add(toCleanString(currentQuestion).toLowerCase());

  const followUp = buildFallbackFollowUp({ question: currentQuestion, role });

  let nextQuestion = followUp.followUpQuestion;
  if (!nextQuestion || askedQuestions.has(nextQuestion.toLowerCase())) {
    const [candidate] = buildFallbackQuestions({
      role,
      difficulty,
      skills,
      projects,
      excludeQuestions: [...askedQuestions],
    });
    nextQuestion =
      candidate?.question ||
      "Tell me about a project decision where you had to balance speed, quality, and maintainability.";
  }

  return {
    interviewerReply: buildMockInterviewReply({ userAnswer, englishLevel }),
    question: nextQuestion,
    shouldEnd: false,
    closingRemark: "",
    focusArea: followUp.reason || "",
    answerSignal:
      "Your previous answer would sound stronger with more concrete detail and clearer reasoning.",
    coachingTip:
      "In the next answer, use one real example and explain why your approach made sense.",
  };
};

const buildMockInterviewFinishFallback = ({ history, role, proctorFlags }) => {
  const answers = history
    .map((item) => toCleanString(item.answer))
    .filter(Boolean);
  const combinedAnswer = answers.join(" ");
  const averageWords =
    answers.reduce(
      (sum, item) => sum + item.split(/\s+/).filter(Boolean).length,
      0,
    ) / Math.max(answers.length, 1);
  const hasExamples = /\b(example|project|built|implemented|used)\b/i.test(
    combinedAnswer,
  );
  const hasReasoning =
    /\b(because|tradeoff|impact|result|performance|scale|latency|reliability)\b/i.test(
      combinedAnswer,
    );
  const hasOwnership = /\b(i|my|we)\b/i.test(combinedAnswer);

  const strengths = [];
  const improvements = [];

  if (averageWords >= 55) {
    strengths.push("You usually gave enough detail for the interviewer to understand your process.");
  } else {
    improvements.push("Add more structure and detail so each answer feels complete.");
  }

  if (hasExamples) {
    strengths.push("You used project-based examples, which made your answers more believable.");
  } else {
    improvements.push("Bring in one concrete project or internship example more often.");
  }

  if (hasReasoning) {
    strengths.push("You explained decisions and tradeoffs instead of only listing steps.");
  } else {
    improvements.push("Explain why you made certain choices so your thinking sounds stronger.");
  }

  if (!hasOwnership) {
    improvements.push("Use first-person ownership more clearly so the interviewer knows what you personally did.");
  }

  let communicationScore = 58;
  let technicalScore = 56;
  let confidenceScore = 57;

  if (averageWords >= 40) communicationScore += 10;
  if (averageWords >= 70) communicationScore += 6;
  if (hasExamples) communicationScore += 7;

  if (hasReasoning) technicalScore += 14;
  if (hasExamples) technicalScore += 8;
  if (history.length >= 3) technicalScore += 5;

  if (hasOwnership) confidenceScore += 11;
  if (averageWords >= 45) confidenceScore += 8;
  if (hasReasoning) confidenceScore += 6;

  communicationScore = Math.max(0, Math.min(100, communicationScore));
  technicalScore = Math.max(0, Math.min(100, technicalScore));
  confidenceScore = Math.max(0, Math.min(100, confidenceScore));

  const overallScore = Math.round(
    (communicationScore + technicalScore + confidenceScore) / 3,
  );

  const integrityNote = proctorFlags.length
    ? `Interview integrity signals were raised ${proctorFlags.length} time(s). Review focus, tab switching, or camera presence before the next practice run.`
    : "";

  return {
    summary:
      `This ${ROLE_CONTEXT[role].label} mock interview showed a promising base. ` +
      `Your overall score is ${overallScore}/100. To improve further, make each answer more example-driven, explain tradeoffs clearly, and keep ownership language strong.`,
    strengths: strengths.slice(0, 3).length
      ? strengths.slice(0, 3)
      : ["You stayed engaged through the interview and addressed the questions directly."],
    improvements: improvements.slice(0, 3).length
      ? improvements.slice(0, 3)
      : ["Keep sharpening your project examples so they land faster and sound more specific."],
    overallScore,
    communicationScore,
    technicalScore,
    confidenceScore,
    hiringSignal:
      overallScore < 80
        ? "Borderline interview-ready with stronger project grounding and clearer decision-making."
        : "Interview-ready signal with solid communication and practical reasoning.",
    communicationSummary:
      "Your communication improves most when you answer with clearer structure and faster examples.",
    technicalSummary:
      "Your technical signal is strongest when you explain the why behind your decisions.",
    confidenceSummary:
      "Confidence rises when you speak with ownership and close with measurable impact.",
    nextSteps: [
      "Prepare 3 concise resume-backed answer stories.",
      "Practice stronger openings and clearer ownership language.",
      "Add one tradeoff or validation step to each technical answer.",
    ],
    integrityNote,
  };
};

const mapQuestionItem = (item = {}, role, difficulty) => ({
  id: toCleanString(item.id) || questionId(toCleanString(item.question)),
  question: toCleanString(item.question),
  focusArea: toCleanString(item.focus_area || item.focusArea),
  questionType: toCleanString(item.question_type || item.questionType),
  difficulty: normalizeDifficulty(item.difficulty || difficulty),
  role: normalizeRole(item.role || role),
  personalization: toCleanString(item.personalization),
  interviewerIntent: toCleanString(
    item.interviewer_intent || item.interviewerIntent,
  ),
  strongSignals: toCleanList(item.strong_signals || item.strongSignals),
  redFlags: toCleanList(item.red_flags || item.redFlags),
  answer: "",
  highlights: [],
  answerFramework: [],
});

const fetchProfileAndSelection = async (req) => {
  const difficulty = normalizeDifficulty(req.body?.difficulty);
  const profile = await buildInterviewProfile(req.user.id, req.body);
  const role = resolveInterviewRole({
    requestedRole: req.body?.role,
    profile,
    resumeContext: {
      resumeText: req.body?.resumeText || req.body?.resume_text,
      resumeSummary: profile.resumeSummary,
      resumeSkills: profile.resumeSkills,
    },
  });

  return {
    role,
    difficulty,
    profile,
  };
};

export const generateInterviewQuestions = async (req, res) => {
  const uploadPath = req.file?.path || "";

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Resume PDF is required.",
      });
    }

    const excludeQuestions = toCleanList(
      req.body?.excludeQuestions || req.body?.exclude_questions,
    );
    const difficulty = normalizeDifficulty(req.body?.difficulty);
    const resumeContext = await extractResumeContext(req.file);
    const profile = await buildInterviewProfile(req.user.id, {
      ...req.body,
      resumeSummary: resumeContext.resumeSummary,
      resumeSkills: resumeContext.resumeSkills,
    });
    const role = resolveInterviewRole({
      requestedRole: req.body?.role,
      profile,
      resumeContext,
    });
    const aiEndpoint = resolveAiEndpoint(
      process.env.AI_SERVICE_URL || "http://127.0.0.1:8001",
      "generate-questions",
    );

    try {
      const response = await axios.post(
        aiEndpoint,
        {
          skills: profile.skills,
          projects: profile.projects,
          experience: profile.experience,
          resume_text: resumeContext.resumeText.slice(0, 5000),
          resume_summary: resumeContext.resumeSummary,
          resume_skills: resumeContext.resumeSkills,
          role,
          difficulty,
          exclude_questions: excludeQuestions,
          count: QUESTION_BATCH_SIZE,
        },
        { timeout: 45000 },
      );

      const seenQuestions = new Set(
        excludeQuestions.map((item) => normalizeQuestionKey(item)),
      );
      const aiQuestions = Array.isArray(response?.data?.questions)
        ? response.data.questions
            .map((item) => mapQuestionItem(item, role, difficulty))
            .filter((item) => {
              const normalized = normalizeQuestionKey(item.question);
              if (!normalized || seenQuestions.has(normalized)) {
                return false;
              }

              seenQuestions.add(normalized);
              return true;
            })
        : [];
      const questions =
        aiQuestions.length >= QUESTION_BATCH_SIZE
          ? aiQuestions.slice(0, QUESTION_BATCH_SIZE)
          : [
              ...aiQuestions,
              ...buildFallbackQuestions({
                role,
                difficulty,
                skills: profile.skills,
                resumeSkills: resumeContext.resumeSkills,
                projects: profile.projects,
                experience: profile.experience,
                resumeSummary: resumeContext.resumeSummary,
                resumeText: resumeContext.resumeText,
                excludeQuestions: [
                  ...excludeQuestions,
                  ...aiQuestions.map((item) => item.question),
                ],
              }).slice(0, QUESTION_BATCH_SIZE - aiQuestions.length),
            ];

      if (!questions.length) {
        throw new Error("AI service returned no questions");
      }

      return res.json({
        success: true,
        role,
        difficulty,
        questions,
        packSummary: toCleanString(
          response?.data?.pack_summary || response?.data?.packSummary,
        ),
        focusAreas: toCleanList(
          response?.data?.focus_areas || response?.data?.focusAreas,
        ),
        warning: response?.data?.fallback_used
          ? "Question generation used the structured fallback."
          : "",
        profile: {
          skills: profile.skills,
          resumeSkills: resumeContext.resumeSkills,
          resumeSummary: resumeContext.resumeSummary,
          resumeFilename: resumeContext.resumeFilename,
          inferredRole: role,
          inferredRoleLabel: ROLE_CONTEXT[role].label,
          projects: profile.projects,
          experience: profile.experience,
          summary: toCleanString(response?.data?.profile_summary || profile.summary),
        },
      });
    } catch (aiError) {
      const reason =
        aiError?.response?.data?.detail ||
        aiError?.response?.data?.message ||
        aiError?.message ||
        "Unknown AI service error";

    const questions = buildFallbackQuestions({
      role,
      difficulty,
      skills: profile.skills,
      resumeSkills: resumeContext.resumeSkills,
      projects: profile.projects,
      experience: profile.experience,
      resumeSummary: resumeContext.resumeSummary,
      resumeText: resumeContext.resumeText,
      excludeQuestions,
      });

      return res.status(200).json({
        success: true,
        role,
        difficulty,
        questions,
        packSummary: `This pack targets ${ROLE_CONTEXT[role].label} interviews at ${difficulty} difficulty and keeps the focus on resume-based, practical conversation.`,
        focusAreas: [...new Set(questions.map((item) => item.focusArea).filter(Boolean))].slice(0, 6),
        warning: `AI question fallback: ${reason}`,
        profile: {
          skills: profile.skills,
          resumeSkills: resumeContext.resumeSkills,
          resumeSummary: resumeContext.resumeSummary,
          resumeFilename: resumeContext.resumeFilename,
          inferredRole: role,
          inferredRoleLabel: ROLE_CONTEXT[role].label,
          projects: profile.projects,
          experience: profile.experience,
          summary: profile.summary,
        },
      });
    }
  } catch (error) {
    console.error("Generate interview questions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate interview questions.",
    });
  } finally {
    deleteUploadIfExists(uploadPath);
  }
};

export const generateInterviewAnswer = async (req, res) => {
  try {
    const question = toCleanString(req.body?.question);
    const previousAnswers = toCleanList(
      req.body?.previousAnswers || req.body?.previous_answers,
    );
    const focusArea = toCleanString(req.body?.focusArea || req.body?.focus_area);
    const questionType = toCleanString(
      req.body?.questionType || req.body?.question_type,
    );
    const personalization = toCleanString(req.body?.personalization);

    if (!question) {
      return res.status(400).json({
        success: false,
        message: "question is required.",
      });
    }

    const { role, difficulty, profile } = await fetchProfileAndSelection(req);
    const aiEndpoint = resolveAiEndpoint(
      process.env.AI_SERVICE_URL || "http://127.0.0.1:8001",
      "generate-answer",
    );

    try {
      const response = await axios.post(
        aiEndpoint,
        {
          question,
          role,
          difficulty,
          skills: profile.skills,
          focus_area: focusArea,
          question_type: questionType,
          personalization,
          resume_summary: profile.resumeSummary,
          resume_skills: profile.resumeSkills,
          projects: profile.projects,
          experience: profile.experience,
          previous_answers: previousAnswers,
        },
        { timeout: 45000 },
      );

      const answer = toCleanString(response?.data?.answer);
      if (!answer || looksLikeAnswerGuidance(answer)) {
        throw new Error("AI service returned guidance instead of a direct answer");
      }

      return res.json({
        success: true,
        question,
        answer,
        highlights: toCleanList(response?.data?.highlights),
        answerFramework: toCleanList(
          response?.data?.answer_framework || response?.data?.answerFramework,
        ),
        answerHook: toCleanString(
          response?.data?.answer_hook || response?.data?.answerHook,
        ),
        deliveryTips: toCleanList(
          response?.data?.delivery_tips || response?.data?.deliveryTips,
        ),
        pitfalls: toCleanList(response?.data?.pitfalls),
        warning: response?.data?.fallback_used
          ? "Answer generation used the structured fallback."
          : "",
      });
    } catch (aiError) {
      const reason =
        aiError?.response?.data?.detail ||
        aiError?.response?.data?.message ||
        aiError?.message ||
        "Unknown AI service error";
      const fallback = buildFallbackAnswer({
        question,
        role,
        skills: profile.skills,
        projects: profile.projects,
        difficulty,
        experience: profile.experience,
        resumeSummary: profile.resumeSummary,
        resumeText: profile.summary || profile.resumeSummary,
        focusArea,
        questionType,
        personalization,
        previousAnswers,
      });

      return res.status(200).json({
        success: true,
        question,
        ...fallback,
        warning: `AI answer fallback: ${reason}`,
      });
    }
  } catch (error) {
    console.error("Generate interview answer error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate interview answer.",
    });
  }
};

export const evaluateInterviewAnswer = async (req, res) => {
  try {
    const question = toCleanString(req.body?.question);
    const userAnswer = toCleanString(req.body?.userAnswer || req.body?.user_answer);

    if (!question || !userAnswer) {
      return res.status(400).json({
        success: false,
        message: "question and userAnswer are required.",
      });
    }

    const { role, difficulty, profile } = await fetchProfileAndSelection(req);
    const aiEndpoint = resolveAiEndpoint(
      process.env.AI_SERVICE_URL || "http://127.0.0.1:8001",
      "evaluate-answer",
    );

    try {
      const response = await axios.post(
        aiEndpoint,
        {
          question,
          user_answer: userAnswer,
          role,
          difficulty,
          resume_summary: profile.resumeSummary,
          resume_skills: profile.resumeSkills,
          projects: profile.projects,
          experience: profile.experience,
        },
        { timeout: 45000 },
      );

      return res.json({
        success: true,
        strengths: toCleanList(response?.data?.strengths),
        weaknesses: toCleanList(response?.data?.weaknesses),
        improvedAnswer: toCleanString(
          response?.data?.improved_answer || response?.data?.improvedAnswer,
        ),
        verdict: toCleanString(response?.data?.verdict),
        score: Number(response?.data?.score ?? 0) || 0,
        improvementPlan: toCleanList(
          response?.data?.improvement_plan || response?.data?.improvementPlan,
        ),
        warning: response?.data?.fallback_used
          ? "Feedback generation used the structured fallback."
          : "",
      });
    } catch (aiError) {
      const reason =
        aiError?.response?.data?.detail ||
        aiError?.response?.data?.message ||
        aiError?.message ||
        "Unknown AI service error";
      const fallback = buildFallbackEvaluation({ userAnswer, role });

      return res.status(200).json({
        success: true,
        ...fallback,
        warning: `AI feedback fallback: ${reason}`,
      });
    }
  } catch (error) {
    console.error("Evaluate interview answer error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to evaluate interview answer.",
    });
  }
};

export const generateInterviewFollowUp = async (req, res) => {
  try {
    const question = toCleanString(req.body?.question);
    const userAnswer = toCleanString(req.body?.userAnswer || req.body?.user_answer);

    if (!question || !userAnswer) {
      return res.status(400).json({
        success: false,
        message: "question and userAnswer are required.",
      });
    }

    const { role, difficulty, profile } = await fetchProfileAndSelection(req);
    const aiEndpoint = resolveAiEndpoint(
      process.env.AI_SERVICE_URL || "http://127.0.0.1:8001",
      "follow-up",
    );

    try {
      const response = await axios.post(
        aiEndpoint,
        {
          question,
          user_answer: userAnswer,
          role,
          difficulty,
          resume_summary: profile.resumeSummary,
          resume_skills: profile.resumeSkills,
          projects: profile.projects,
          experience: profile.experience,
        },
        { timeout: 30000 },
      );

      const followUpQuestion = toCleanString(
        response?.data?.follow_up_question || response?.data?.followUpQuestion,
      );

      if (!followUpQuestion) {
        throw new Error("AI service returned empty follow-up question");
      }

      return res.json({
        success: true,
        followUpQuestion,
        reason: toCleanString(response?.data?.reason),
        whatToCover: toCleanList(
          response?.data?.what_to_cover || response?.data?.whatToCover,
        ),
        warning: response?.data?.fallback_used
          ? "Follow-up generation used the structured fallback."
          : "",
      });
    } catch (aiError) {
      const reason =
        aiError?.response?.data?.detail ||
        aiError?.response?.data?.message ||
        aiError?.message ||
        "Unknown AI service error";
      const fallback = buildFallbackFollowUp({ question, role });

      return res.status(200).json({
        success: true,
        ...fallback,
        warning: `AI follow-up fallback: ${reason}`,
      });
    }
  } catch (error) {
    console.error("Generate interview follow-up error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate follow-up question.",
    });
  }
};

export const startMockInterview = async (req, res) => {
  const uploadPath = req.file?.path || "";

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Resume PDF is required.",
      });
    }

    const difficulty = normalizeDifficulty(req.body?.difficulty);
    const englishLevel = normalizeEnglishLevel(
      req.body?.englishLevel || req.body?.english_level,
    );
    const totalQuestions = normalizeQuestionCount(
      req.body?.totalQuestions || req.body?.total_questions,
    );
    const resumeContext = await extractResumeContext(req.file);
    const profile = await buildInterviewProfile(req.user.id, {
      ...req.body,
      resumeSummary: resumeContext.resumeSummary,
      resumeSkills: resumeContext.resumeSkills,
    });
    const role = resolveInterviewRole({
      requestedRole: req.body?.role,
      profile,
      resumeContext,
    });
    const aiEndpoint = resolveAiEndpoint(
      process.env.AI_SERVICE_URL || "http://127.0.0.1:8001",
      "mock-interview/start",
    );

    try {
      const response = await axios.post(
        aiEndpoint,
        {
          skills: profile.skills,
          projects: profile.projects,
          experience: profile.experience,
          resume_text: resumeContext.resumeText.slice(0, 5000),
          resume_summary: resumeContext.resumeSummary,
          resume_skills: resumeContext.resumeSkills,
          role,
          difficulty,
          english_level: englishLevel,
          total_questions: totalQuestions,
        },
        { timeout: 45000 },
      );

      const opening = toCleanString(response?.data?.opening);
      const question = toCleanString(
        response?.data?.first_question || response?.data?.firstQuestion,
      );

      if (!opening || !question) {
        throw new Error("AI service returned an incomplete mock interview start payload");
      }

      return res.json({
        success: true,
        role,
        difficulty,
        englishLevel,
        totalQuestions,
        opening,
        question,
        interviewerStyle: toCleanString(
          response?.data?.interviewer_style || response?.data?.interviewerStyle,
        ),
        candidateBrief: toCleanString(
          response?.data?.candidate_brief || response?.data?.candidateBrief,
        ),
        focusAreas: toCleanList(
          response?.data?.focus_areas || response?.data?.focusAreas,
        ),
        warning: response?.data?.fallback_used
          ? "Mock interview start used the structured fallback."
          : "",
        profile: {
          skills: profile.skills,
          resumeSkills: resumeContext.resumeSkills,
          resumeSummary: resumeContext.resumeSummary,
          resumeFilename: resumeContext.resumeFilename,
          projects: profile.projects,
          experience: profile.experience,
          summary: profile.summary,
        },
      });
    } catch (aiError) {
      const reason =
        aiError?.response?.data?.detail ||
        aiError?.response?.data?.message ||
        aiError?.message ||
        "Unknown AI service error";
      const fallback = buildMockInterviewStartFallback({
        role,
        difficulty,
        englishLevel,
        totalQuestions,
        skills: profile.skills,
        projects: profile.projects,
      });

      return res.status(200).json({
        success: true,
        role,
        difficulty,
        englishLevel,
        totalQuestions,
        ...fallback,
        warning: `AI mock interview start fallback: ${reason}`,
        profile: {
          skills: profile.skills,
          resumeSkills: resumeContext.resumeSkills,
          resumeSummary: resumeContext.resumeSummary,
          resumeFilename: resumeContext.resumeFilename,
          projects: profile.projects,
          experience: profile.experience,
          summary: profile.summary,
        },
      });
    }
  } catch (error) {
    console.error("Start mock interview error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start mock interview.",
    });
  } finally {
    deleteUploadIfExists(uploadPath);
  }
};

export const continueMockInterview = async (req, res) => {
  try {
    const currentQuestion = toCleanString(
      req.body?.currentQuestion || req.body?.current_question,
    );
    const userAnswer = toCleanString(
      req.body?.userAnswer || req.body?.user_answer,
    );
    const history = normalizeMockInterviewHistory(req.body?.history);

    if (!currentQuestion || !userAnswer) {
      return res.status(400).json({
        success: false,
        message: "currentQuestion and userAnswer are required.",
      });
    }

    const questionIndex = normalizeQuestionCount(
      req.body?.questionIndex || req.body?.question_index,
      { min: 1, max: 20, fallback: 1 },
    );
    const totalQuestions = normalizeQuestionCount(
      req.body?.totalQuestions || req.body?.total_questions,
      { min: 3, max: 8, fallback: 5 },
    );
    const englishLevel = normalizeEnglishLevel(
      req.body?.englishLevel || req.body?.english_level,
    );
    const { role, difficulty, profile } = await fetchProfileAndSelection(req);
    const aiEndpoint = resolveAiEndpoint(
      process.env.AI_SERVICE_URL || "http://127.0.0.1:8001",
      "mock-interview/next",
    );

    try {
      const response = await axios.post(
        aiEndpoint,
        {
          current_question: currentQuestion,
          user_answer: userAnswer,
          history: history.map((item) => ({
            question: item.question,
            answer: item.answer,
            interviewer_reply: item.interviewerReply,
          })),
          skills: profile.skills,
          projects: profile.projects,
          experience: profile.experience,
          resume_summary: profile.resumeSummary,
          resume_skills: profile.resumeSkills,
          role,
          difficulty,
          english_level: englishLevel,
          question_index: questionIndex,
          total_questions: totalQuestions,
        },
        { timeout: 45000 },
      );

      return res.json({
        success: true,
        interviewerReply: toCleanString(
          response?.data?.interviewer_reply || response?.data?.interviewerReply,
        ),
        question: toCleanString(
          response?.data?.next_question || response?.data?.nextQuestion,
        ),
        shouldEnd: Boolean(response?.data?.should_end ?? response?.data?.shouldEnd),
        closingRemark: toCleanString(
          response?.data?.closing_remark || response?.data?.closingRemark,
        ),
        focusArea: toCleanString(
          response?.data?.focus_area || response?.data?.focusArea,
        ),
        answerSignal: toCleanString(
          response?.data?.answer_signal || response?.data?.answerSignal,
        ),
        coachingTip: toCleanString(
          response?.data?.coaching_tip || response?.data?.coachingTip,
        ),
        warning: response?.data?.fallback_used
          ? "Mock interview continuation used the structured fallback."
          : "",
      });
    } catch (aiError) {
      const reason =
        aiError?.response?.data?.detail ||
        aiError?.response?.data?.message ||
        aiError?.message ||
        "Unknown AI service error";
      const fallback = buildMockInterviewTurnFallback({
        currentQuestion,
        userAnswer,
        role,
        difficulty,
        englishLevel,
        questionIndex,
        totalQuestions,
        skills: profile.skills,
        projects: profile.projects,
        history,
      });

      return res.status(200).json({
        success: true,
        ...fallback,
        warning: `AI mock interview continuation fallback: ${reason}`,
      });
    }
  } catch (error) {
    console.error("Continue mock interview error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to continue mock interview.",
    });
  }
};

export const finishMockInterview = async (req, res) => {
  try {
    const history = normalizeMockInterviewHistory(req.body?.history);
    const proctorFlags = toCleanList(
      req.body?.proctorFlags || req.body?.proctor_flags,
    );

    if (!history.length) {
      return res.status(400).json({
        success: false,
        message: "history is required.",
      });
    }

    const englishLevel = normalizeEnglishLevel(
      req.body?.englishLevel || req.body?.english_level,
    );
    const totalQuestions = normalizeQuestionCount(
      req.body?.totalQuestions || req.body?.total_questions,
      { min: 3, max: 8, fallback: 5 },
    );
    const { role, difficulty, profile } = await fetchProfileAndSelection(req);
    const aiEndpoint = resolveAiEndpoint(
      process.env.AI_SERVICE_URL || "http://127.0.0.1:8001",
      "mock-interview/finish",
    );

    try {
      const response = await axios.post(
        aiEndpoint,
        {
          history: history.map((item) => ({
            question: item.question,
            answer: item.answer,
            interviewer_reply: item.interviewerReply,
          })),
          skills: profile.skills,
          projects: profile.projects,
          experience: profile.experience,
          resume_summary: profile.resumeSummary,
          resume_skills: profile.resumeSkills,
          role,
          difficulty,
          english_level: englishLevel,
          total_questions: totalQuestions,
          proctor_flags: proctorFlags,
        },
        { timeout: 45000 },
      );

      return res.json({
        success: true,
        summary: toCleanString(response?.data?.summary),
        strengths: toCleanList(response?.data?.strengths),
        improvements: toCleanList(response?.data?.improvements),
        overallScore: Number(
          response?.data?.overall_score ?? response?.data?.overallScore ?? 0,
        ) || 0,
        communicationScore: Number(
          response?.data?.communication_score ??
            response?.data?.communicationScore ??
            0,
        ) || 0,
        technicalScore: Number(
          response?.data?.technical_score ?? response?.data?.technicalScore ?? 0,
        ) || 0,
        confidenceScore: Number(
          response?.data?.confidence_score ??
            response?.data?.confidenceScore ??
            0,
        ) || 0,
        hiringSignal: toCleanString(
          response?.data?.hiring_signal || response?.data?.hiringSignal,
        ),
        communicationSummary: toCleanString(
          response?.data?.communication_summary || response?.data?.communicationSummary,
        ),
        technicalSummary: toCleanString(
          response?.data?.technical_summary || response?.data?.technicalSummary,
        ),
        confidenceSummary: toCleanString(
          response?.data?.confidence_summary || response?.data?.confidenceSummary,
        ),
        nextSteps: toCleanList(
          response?.data?.next_steps || response?.data?.nextSteps,
        ),
        integrityNote: toCleanString(
          response?.data?.integrity_note || response?.data?.integrityNote,
        ),
        warning: response?.data?.fallback_used
          ? "Mock interview summary used the structured fallback."
          : "",
      });
    } catch (aiError) {
      const reason =
        aiError?.response?.data?.detail ||
        aiError?.response?.data?.message ||
        aiError?.message ||
        "Unknown AI service error";
      const fallback = buildMockInterviewFinishFallback({
        history,
        role,
        proctorFlags,
      });

      return res.status(200).json({
        success: true,
        ...fallback,
        warning: `AI mock interview summary fallback: ${reason}`,
      });
    }
  } catch (error) {
    console.error("Finish mock interview error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to finish mock interview.",
    });
  }
};
