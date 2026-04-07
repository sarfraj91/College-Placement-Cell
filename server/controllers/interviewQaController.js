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


const ROLE_ALIASES = {
  frontend: "frontend",
  "front end": "frontend",
  backend: "backend",
  "back end": "backend",
  "full stack": "full stack",
  fullstack: "full stack",
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
      "React component architecture",
      "state management and API integration",
      "performance debugging",
      "accessibility and responsive UI",
      "testing UI flows",
      "reusable component design",
    ],
  },
  backend: {
    label: "Backend Developer",
    scenario: "an AI-powered placement platform",
    topics: [
      "API design and validation",
      "database schema and query optimization",
      "authentication and authorization",
      "debugging latency issues",
      "caching and scalability",
      "async processing and reliability",
    ],
  },
  "full stack": {
    label: "Full Stack Developer",
    scenario: "an end-to-end placement workflow",
    topics: [
      "frontend-backend integration",
      "feature design across React and APIs",
      "cross-service debugging",
      "auth and user workflows",
      "delivery tradeoffs",
      "testing and monitoring",
    ],
  },
};

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

const buildFallbackQuestions = ({
  role,
  difficulty,
  skills,
  projects,
  excludeQuestions = [],
}) => {
  const context = ROLE_CONTEXT[role];
  const patterns = QUESTION_PATTERNS[difficulty];
  const scenario = context.scenario;
  const skillFocus = skills.slice(0, 3).join(", ") || "core software skills";
  const excluded = new Set(excludeQuestions.map((item) => item.toLowerCase()));
  const questions = [];

  context.topics.forEach((topic, index) => {
    patterns.forEach((template, templateIndex) => {
      if (questions.length >= 10) {
        return;
      }

      let question = template
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
      questions.push({
        id: questionId(question),
        question,
        focusArea: topic,
        questionType:
          (index + templateIndex) % 3 === 0
            ? "conceptual"
            : (index + templateIndex) % 3 === 1
              ? "practical"
              : "debugging",
        difficulty,
        role,
        personalization: `Built to match your target role and background in ${skillFocus}.`,
      });
    });
  });

  return questions;
};

const buildFallbackAnswer = ({ question, role, skills, projects, difficulty }) => {
  const skillFocus = skills.slice(0, 4).join(", ") || "role-relevant fundamentals";
  const projectHint = projects || "a recent academic or personal project";
  let answer =
    `I would answer this by first clarifying the goal, the constraints, and the tradeoffs that matter most for a ${ROLE_CONTEXT[role].label} role. ` +
    `Then I would describe the implementation steps using ${skillFocus} where it makes sense. ` +
    `To keep the answer practical, I would connect it to ${projectHint} and explain what I built, why I chose that approach, and how I validated the result. ` +
    "I would close by mentioning testing, edge cases, and one tradeoff I would revisit if scale or requirements changed.";

  if (difficulty === "hard") {
    answer =
      `For a harder version of this question, I would frame my answer around architecture, scale, and tradeoffs. ` +
      `I would start with the business goal, explain the system boundaries, and justify the design choices based on maintainability, reliability, and performance. ` +
      `Next, I would walk through a project-style example using ${skillFocus} and show how I would monitor, test, and evolve the solution. ` +
      "Finally, I would discuss one failure mode and how I would redesign the implementation if production feedback exposed a bottleneck.";
  }

  return {
    answer,
    highlights: [
      "Open with the problem, constraints, and success criteria.",
      "Use a concrete example from your projects or internships.",
      "Call out testing, tradeoffs, and measurable impact.",
    ],
    answerFramework: [
      "State the goal clearly.",
      "Explain the implementation approach.",
      "Share a project example.",
      "Close with tradeoffs and validation.",
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
  };
};

const buildFallbackFollowUp = ({ question, role }) => {
  const loweredQuestion = toCleanString(question).toLowerCase();

  if (role === "frontend" || /react|ui|frontend|accessibility/.test(loweredQuestion)) {
    return {
      followUpQuestion:
        "How would you measure whether that frontend decision actually improved performance, accessibility, and user experience in production?",
      reason: "Pushes deeper on validation, metrics, and real-world frontend tradeoffs.",
    };
  }

  if (role === "backend" || /api|database|backend|cache|latency/.test(loweredQuestion)) {
    return {
      followUpQuestion:
        "If traffic increased 10x after launch, what would you change first in the API, database, and monitoring strategy?",
      reason: "Explores scale, reliability, and operational thinking.",
    };
  }

  return {
    followUpQuestion:
      "What tradeoff would you revisit first if this solution had to support more users, faster iteration, and stricter reliability requirements?",
    reason: "Moves the discussion from implementation to senior-level tradeoff thinking.",
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

const buildMockInterviewOpening = ({ role, englishLevel, totalQuestions }) => {
  const roleLabel = ROLE_CONTEXT[role].label;

  if (englishLevel === "basic") {
    return (
      `Hi, welcome. I will take your ${roleLabel} mock interview today. ` +
      `We will go through ${totalQuestions} questions, and I want simple, honest answers with examples.`
    );
  }

  if (englishLevel === "advanced") {
    return (
      `Thanks for joining. I will be your ${roleLabel} interviewer today, and we will work through ` +
      `${totalQuestions} realistic questions with follow-ups where your decisions need deeper justification.`
    );
  }

  return (
    `Thanks for joining. I will act as your ${roleLabel} interviewer today. ` +
    `We will work through ${totalQuestions} realistic questions, so answer naturally and use examples from your work whenever possible.`
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
    opening: buildMockInterviewOpening({ role, englishLevel, totalQuestions }),
    question:
      firstQuestion?.question ||
      "Tell me about a project from your resume and the most important technical decision you made.",
    interviewerStyle:
      englishLevel === "advanced"
        ? "polished and challenging interviewer tone"
        : englishLevel === "basic"
          ? "clear and supportive interviewer tone"
          : "natural and professional interviewer tone",
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
});

const fetchProfileAndSelection = async (req) => {
  const role = normalizeRole(req.body?.role);
  const difficulty = normalizeDifficulty(req.body?.difficulty);
  const profile = await buildInterviewProfile(req.user.id, req.body);

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
    const role = normalizeRole(req.body?.role);
    const difficulty = normalizeDifficulty(req.body?.difficulty);
    const resumeContext = await extractResumeContext(req.file);
    const profile = await buildInterviewProfile(req.user.id, {
      ...req.body,
      resumeSummary: resumeContext.resumeSummary,
      resumeSkills: resumeContext.resumeSkills,
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
          count: 10,
        },
        { timeout: 45000 },
      );

      const questions = Array.isArray(response?.data?.questions)
        ? response.data.questions
            .map((item) => mapQuestionItem(item, role, difficulty))
            .filter((item) => item.question)
        : [];

      if (!questions.length) {
        throw new Error("AI service returned no questions");
      }

      return res.json({
        success: true,
        role,
        difficulty,
        questions,
        warning: response?.data?.fallback_used
          ? "Question generation used the structured fallback."
          : "",
        profile: {
          skills: profile.skills,
          resumeSkills: resumeContext.resumeSkills,
          resumeSummary: resumeContext.resumeSummary,
          resumeFilename: resumeContext.resumeFilename,
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
        projects: profile.projects,
        excludeQuestions,
      });

      return res.status(200).json({
        success: true,
        role,
        difficulty,
        questions,
        warning: `AI question fallback: ${reason}`,
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
          resume_summary: profile.resumeSummary,
          resume_skills: profile.resumeSkills,
          projects: profile.projects,
          experience: profile.experience,
          previous_answers: previousAnswers,
        },
        { timeout: 45000 },
      );

      const answer = toCleanString(response?.data?.answer);
      if (!answer) {
        throw new Error("AI service returned empty answer");
      }

      return res.json({
        success: true,
        question,
        answer,
        highlights: toCleanList(response?.data?.highlights),
        answerFramework: toCleanList(
          response?.data?.answer_framework || response?.data?.answerFramework,
        ),
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

    const { role, difficulty } = await fetchProfileAndSelection(req);
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

    const { role, difficulty } = await fetchProfileAndSelection(req);
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

    const role = normalizeRole(req.body?.role);
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
