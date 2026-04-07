import axios from "axios";

const toCleanString = (value) =>
  typeof value === "string" ? value.trim() : "";

const toCleanList = (value) => {
  if (!value) return [];

  const source = Array.isArray(value) ? value : String(value).split(",");
  const normalized = source
    .map((item) => toCleanString(String(item)))
    .filter(Boolean);

  return [...new Set(normalized)];
};

const joinOrFallback = (items, fallback = "Not specified") =>
  items.length > 0 ? items.join(", ") : fallback;

const wordCount = (text = "") =>
  String(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const looksLikePromptLeak = (text = "") => {
  const lowered = String(text).toLowerCase();
  const markers = [
    "you are a senior technical recruiter",
    "structure:",
    "style rules:",
    "must-have skills:",
    "good-to-have skills:",
    "tech stack / dependencies:",
    "company overview:",
  ];
  const matched = markers.reduce(
    (count, marker) => (lowered.includes(marker) ? count + 1 : count),
    0,
  );
  return matched >= 3;
};

const buildFallbackDescription = (payload) => {
  const responsibilities = payload.responsibilities.length
    ? payload.responsibilities
    : [
        "Design, develop, and deliver high-quality features",
        "Collaborate with cross-functional stakeholders",
        "Ensure reliability, performance, and maintainability",
      ];

  const requiredSkills = payload.skills.length
    ? payload.skills
    : ["Problem solving", "Communication", "Team collaboration"];

  const goodToHaveSkills = payload.goodToHave.length
    ? payload.goodToHave
    : payload.dependencies.slice(0, 3);

  return [
    `${payload.companyName} is seeking a ${payload.jobTitle} to join our ${payload.department || "core"} team.`,
    "",
    "About the Role:",
    `This is a ${payload.employmentType || "full-time"} ${payload.workMode ? `(${payload.workMode})` : ""} opportunity ${payload.location ? `based in ${payload.location}` : ""}.`,
    "You will work on impactful initiatives and collaborate closely with teams to build reliable, scalable solutions that drive measurable outcomes.",
    "",
    "Key Responsibilities:",
    ...responsibilities.map((item) => `- ${item}`),
    "",
    "Required Skills:",
    `- ${joinOrFallback(requiredSkills)}`,
    "",
    "Good to Have:",
    `- ${joinOrFallback(goodToHaveSkills, "Domain experience and a strong learning mindset")}`,
    "",
    "Tech Stack / Dependencies:",
    `- ${joinOrFallback(payload.dependencies, "Modern engineering tools and collaboration platforms")}`,
    "",
    "Why Join Us:",
    `At ${payload.companyName}, you will work in a growth-focused environment with ownership, mentorship, and opportunities to contribute to meaningful projects from day one.`,
  ]
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
};

export const generateJobDescription = async (req, res) => {
  try {
    const jobTitle = toCleanString(req.body?.jobTitle);
    const companyName = toCleanString(req.body?.companyName || req.body?.company);
    const companyOverview = toCleanString(
      req.body?.companyOverview || req.body?.companyDescription,
    );
    const employmentType = toCleanString(req.body?.employmentType);
    const workMode = toCleanString(req.body?.workMode);
    const location = toCleanString(req.body?.location);
    const department = toCleanString(req.body?.department);
    const experienceLevel = toCleanString(req.body?.experienceLevel);
    const currentDescription = toCleanString(
      req.body?.currentDescription || req.body?.existingDescription,
    );
    const improvementInstructions = toCleanString(
      req.body?.improvementInstructions || req.body?.regenerationPrompt,
    );

    const skills = toCleanList(req.body?.skills || req.body?.mustHaveSkills);
    const goodToHave = toCleanList(
      req.body?.goodToHave || req.body?.goodToHaveSkills,
    );
    const responsibilities = toCleanList(req.body?.responsibilities);
    const dependencies = toCleanList(
      req.body?.dependencies || req.body?.techStack || req.body?.tools,
    );
    const benefits = toCleanList(req.body?.benefits);

    if (!jobTitle || !companyName) {
      return res.status(400).json({
        success: false,
        message: "jobTitle and companyName are required",
      });
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://127.0.0.1:8001";

    const payload = {
      jobTitle,
      companyName,
      companyOverview,
      employmentType,
      workMode,
      location,
      department,
      experienceLevel,
      skills,
      goodToHave,
      responsibilities,
      dependencies,
      benefits,
      currentDescription,
      improvementInstructions,
    };

    let provider = "ai-service";
    let description = "";
    let warning = "";
    let generationMode = currentDescription ? "regenerate" : "generate";

    try {
      const response = await axios.post(
        `${aiServiceUrl}/generate-job-description`,
        {
          job_title: jobTitle,
          company: companyName,
          company_overview: companyOverview,
          employment_type: employmentType,
          work_mode: workMode,
          location,
          department,
          experience_level: experienceLevel,
          skills,
          good_to_have: goodToHave,
          responsibilities,
          dependencies,
          benefits,
          current_description: currentDescription,
          improvement_instructions: improvementInstructions,
        },
        { timeout: 45000 },
      );

      description = toCleanString(response?.data?.description);
      generationMode = response?.data?.generation_mode || generationMode;
      if (response?.data?.fallback_used) {
        provider = generationMode === "regenerate"
          ? "regeneration-fallback"
          : "template-fallback";
        warning =
          generationMode === "regenerate"
            ? "AI refinement used the structured rewrite fallback to apply your instructions."
            : "AI generation used the structured template fallback.";
      }
      if (!description) {
        throw new Error("AI service returned empty description");
      }

      if (looksLikePromptLeak(description) || wordCount(description) < 45) {
        throw new Error(
          "AI service returned prompt/instruction text instead of final job description",
        );
      }
    } catch (aiError) {
      const aiReason =
        aiError?.response?.data?.detail ||
        aiError?.response?.data?.message ||
        aiError?.message ||
        "Unknown AI service error";

      warning = `AI generation fallback: ${aiReason}`;
      console.warn(
        "AI job description generation failed, using fallback template:",
        aiReason,
      );
      provider = currentDescription ? "regeneration-fallback" : "template-fallback";
      description =
        currentDescription && wordCount(currentDescription) >= 45
          ? currentDescription
          : buildFallbackDescription(payload);
    }

    res.json({
      success: true,
      provider,
      warning,
      description,
      generationMode,
      input: {
        jobTitle,
        companyName,
        skills,
        dependencies,
        improvementInstructions,
      },
    });
  } catch (error) {
    console.error("Generate job description error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate job description",
    });
  }
};
