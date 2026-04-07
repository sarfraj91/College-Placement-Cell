import natural from "natural";
import { removeStopwords } from "stopword";

const tokenizer = new natural.WordTokenizer();

const SKILL_ALIASES = {
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
  postgresql: ["postgresql", "postgres", "postgre sql"],
  mongodb: ["mongodb", "mongo db"],
  redis: ["redis"],
  docker: ["docker"],
  kubernetes: ["kubernetes", "k8s"],
  aws: ["aws", "amazon web services"],
  azure: ["azure", "microsoft azure"],
  gcp: ["gcp", "google cloud", "google cloud platform"],
  git: ["git", "github"],
  linux: ["linux"],
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
  excel: ["excel"],
};

const uniqueList = (items = []) => {
  const seen = new Set();
  const unique = [];

  items.forEach((item) => {
    const value = String(item || "").trim();
    const normalized = value.toLowerCase();

    if (!value || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    unique.push(value);
  });

  return unique;
};

const containsAlias = (text, aliases = []) =>
  aliases.some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const flexible = escaped.replace(/\s+/g, "\\s+");
    const pattern = new RegExp(`(^|[^\\w])${flexible}($|[^\\w])`, "i");
    return pattern.test(text);
  });

const extractSkills = (text = "") => {
  const lowered = String(text || "").toLowerCase();

  return Object.entries(SKILL_ALIASES)
    .filter(([, aliases]) => containsAlias(lowered, aliases))
    .map(([skill]) => skill);
};

const buildSuggestion = (skill) => {
  if (["docker", "kubernetes", "aws", "azure", "gcp"].includes(skill)) {
    return `Add a project or deployment example that proves hands-on work with ${skill}.`;
  }

  if (["sql", "mysql", "postgresql", "mongodb", "redis"].includes(skill)) {
    return `Show database work involving ${skill}, including querying, schema design, or optimization.`;
  }

  return `Add project or internship evidence that demonstrates ${skill} in practice.`;
};

export const analyzeResume = (resumeText, jobDescription) => {
  const loweredResume = String(resumeText || "").toLowerCase();
  const loweredJob = String(jobDescription || "").toLowerCase();

  const resumeTokens = tokenizer.tokenize(loweredResume);
  const jobTokens = tokenizer.tokenize(loweredJob);

  const resumeWords = removeStopwords(resumeTokens);
  const jobWords = removeStopwords(jobTokens);

  const resumeSet = new Set(resumeWords);
  const jobSet = new Set(jobWords);
  const tokenOverlap = [...resumeSet].filter((token) => jobSet.has(token)).length;
  const tokenScore = jobSet.size
    ? Math.round((tokenOverlap / jobSet.size) * 100)
    : 0;

  const jobSkills = extractSkills(jobDescription);
  const resumeSkills = extractSkills(resumeText);
  const matchedSkills = resumeSkills.filter((skill) => jobSkills.includes(skill));
  const missingSkills = jobSkills.filter((skill) => !resumeSkills.includes(skill));

  const skillScore = jobSkills.length
    ? Math.round((matchedSkills.length / jobSkills.length) * 100)
    : tokenScore;
  const score = Math.max(skillScore, tokenScore);

  const suggestions = missingSkills.map(buildSuggestion);

  if (!loweredResume.includes("project")) {
    suggestions.push("Add a project section with technologies, responsibilities, and outcomes.");
  }

  if (!loweredResume.includes("github") && !loweredResume.includes("portfolio")) {
    suggestions.push("Include a GitHub, portfolio, or deployment link for your strongest work.");
  }

  if (!/\b\d/.test(loweredResume)) {
    suggestions.push("Add measurable achievements such as performance gains, accuracy, or delivery improvements.");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    resumeSkills,
    jobSkills,
    matchedSkills,
    missingSkills,
    skillGapPercent: jobSkills.length
      ? Math.round((missingSkills.length / jobSkills.length) * 100)
      : 0,
    suggestions: uniqueList(suggestions),
  };
};
