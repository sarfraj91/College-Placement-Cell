import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Loader2,
  MessageCircle,
  Minus,
  Sparkles,
} from "lucide-react";

import { askPlacementAssistant } from "../../services/chatbotApi.jsx";
import { getStudentJobs } from "../../services/jobApi.jsx";
import { readChatbotContext } from "../../utils/chatbotContext.js";


const STARTER_ACTIONS = [
  {
    label: "Review my resume gaps",
    prompt: "What are the biggest gaps in my resume for the selected job?",
  },
  {
    label: "I want software developer skills",
    prompt: "What skills are required for software developer roles?",
  },
  {
    label: "I need interview preparation",
    prompt: "How should I prepare for technical interviews this week?",
  },
  {
    label: "Tell me missing skills for frontend",
    prompt: "What skills are required for frontend developer roles?",
  },
  {
    label: "Tell me missing skills for backend",
    prompt: "What skills are required for backend developer roles?",
  },
  {
    label: "How do I improve my ATS score?",
    prompt: "How can I improve my resume for ATS-based screening?",
  },
  {
    label: "Suggest projects for my skill gaps",
    prompt: "Suggest projects to close my current skill gaps.",
  },
  {
    label: "Which roles fit my profile?",
    prompt: "Which job roles match my current profile best?",
  },
  {
    label: "What should I study this week?",
    prompt: "Give me a one-week placement preparation plan.",
  },
  {
    label: "How should I explain my projects?",
    prompt: "How should I explain my projects in interviews?",
  },
  {
    label: "How do I prepare for HR round?",
    prompt: "How should I prepare for HR interview rounds?",
  },
];

const INVALID_SCOPE_COPY =
  "Please ask a meaningful and relevant placement-related question. I can help with resumes, skills, jobs, applications, and interview preparation.";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createMessage = (role, content = "", extra = {}) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  ...extra,
});

const normalizeSpeechTranscript = (value = "") =>
  String(value).replace(/\s+/g, " ").trim();

const PLACEMENT_KEYWORDS = new Set([
  "placement",
  "placements",
  "resume",
  "resumes",
  "cv",
  "job",
  "jobs",
  "career",
  "careers",
  "role",
  "roles",
  "skill",
  "skills",
  "interview",
  "interviews",
  "interviewer",
  "interviewers",
  "ats",
  "application",
  "applications",
  "apply",
  "applying",
  "eligibility",
  "shortlist",
  "shortlisted",
  "screening",
  "assessment",
  "test",
  "tests",
  "aptitude",
  "coding",
  "technical",
  "hr",
  "project",
  "projects",
  "internship",
  "internships",
  "campus",
  "recruiter",
  "recruiters",
  "offer",
  "offers",
  "salary",
  "package",
  "ctc",
  "roadmap",
  "study",
  "prepare",
  "preparation",
  "learning",
  "frontend",
  "backend",
  "developer",
  "development",
  "fullstack",
  "dsa",
  "linkedin",
  "portfolio",
]);

const PLACEMENT_PHRASES = [
  "tell me about yourself",
  "self introduction",
  "introduce myself",
  "cover letter",
  "mock interview",
  "placement preparation",
  "campus placement",
  "hr round",
  "technical round",
  "interview preparation",
  "resume summary",
  "resume gap",
  "ats score",
  "job description",
  "missing skills",
];

const extractNormalizedTokens = (value = "") =>
  normalizeSpeechTranscript(value)
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((token) => token.length >= 2);

const buildPlacementContextKeywords = ({
  activeJobSnapshot = null,
  resumeAnalysis = null,
} = {}) => {
  const contextValues = [
    activeJobSnapshot?.jobTitle,
    activeJobSnapshot?.company,
    activeJobSnapshot?.description,
    ...(Array.isArray(activeJobSnapshot?.skills)
      ? activeJobSnapshot.skills
      : []),
    ...(Array.isArray(resumeAnalysis?.resumeSkills)
      ? resumeAnalysis.resumeSkills
      : []),
    ...(Array.isArray(resumeAnalysis?.resume_skills)
      ? resumeAnalysis.resume_skills
      : []),
  ];

  return new Set(
    contextValues.flatMap((value) =>
      extractNormalizedTokens(value).filter((token) => token.length >= 3),
    ),
  );
};

const isPlacementRelevantQuestion = (question, context = {}) => {
  const normalizedQuestion = normalizeSpeechTranscript(question).toLowerCase();
  if (!normalizedQuestion) {
    return false;
  }

  if (PLACEMENT_PHRASES.some((phrase) => normalizedQuestion.includes(phrase))) {
    return true;
  }

  const questionTokens = extractNormalizedTokens(normalizedQuestion);
  if (questionTokens.some((token) => PLACEMENT_KEYWORDS.has(token))) {
    return true;
  }

  const contextKeywords = buildPlacementContextKeywords(context);
  return questionTokens.some((token) => contextKeywords.has(token));
};

const buildActiveJobSnapshot = (job) => {
  if (!job) {
    return null;
  }

  return {
    jobId: job._id || "",
    jobTitle: job.jobTitle || "",
    company: job.company?.name || "",
    description: job.jobDescription || "",
    skills: job.skills?.mustHave || [],
    location: job.employmentDetails?.location || "",
    workMode: job.employmentDetails?.workMode || "",
    employmentType: job.employmentDetails?.employmentType || "",
  };
};

const normalizeHistory = (messages) =>
  messages
    .filter(
      (message) => message.role === "assistant" || message.role === "user",
    )
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

const normalizeStructuredList = (value, limit = 4) =>
  Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, limit)
    : [];

const normalizeChatSections = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => ({
      title: String(item?.title || "").trim(),
      items: normalizeStructuredList(item?.items, 4),
    }))
    .filter((item) => item.title && item.items.length)
    .slice(0, 3);

const ChatBot = ({ selectedJobId = "", resumeAnalysis = null }) => {
  const storedContextRef = useRef(readChatbotContext());
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [focusJobId, setFocusJobId] = useState(
    selectedJobId || storedContextRef.current?.selectedJobId || "",
  );
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [warning, setWarning] = useState("");

  const bottomRef = useRef(null);

  const effectiveResumeAnalysis =
    resumeAnalysis || storedContextRef.current?.resumeAnalysis || null;
  const storedActiveJobSnapshot =
    storedContextRef.current?.activeJobSnapshot || null;

  useEffect(() => {
    if (selectedJobId) {
      setFocusJobId(selectedJobId);
    }
  }, [selectedJobId]);

  useEffect(() => {
    if (!open || jobsLoading || jobs.length > 0) {
      return;
    }

    let mounted = true;

    const loadJobs = async () => {
      try {
        setJobsLoading(true);
        const response = await getStudentJobs();
        if (!mounted) {
          return;
        }

        setJobs(response?.data?.jobs || []);
      } catch {
        if (mounted) {
          setJobs([]);
        }
      } finally {
        if (mounted) {
          setJobsLoading(false);
        }
      }
    };

    loadJobs();
    return () => {
      mounted = false;
    };
  }, [open, jobsLoading, jobs.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking, streaming]);

  const focusedJob = useMemo(
    () => jobs.find((job) => job._id === focusJobId),
    [jobs, focusJobId],
  );

  const effectiveActiveJobSnapshot = useMemo(() => {
    if (focusedJob) {
      return buildActiveJobSnapshot(focusedJob);
    }

    if (
      storedActiveJobSnapshot &&
      (!focusJobId || storedActiveJobSnapshot.jobId === focusJobId)
    ) {
      return storedActiveJobSnapshot;
    }

    return null;
  }, [focusedJob, focusJobId, storedActiveJobSnapshot]);

  const streamAssistantMessage = async (payload) => {
    const invalidQuery = payload?.answerMode === "scope-redirect";
    const fullText = String(
      invalidQuery ? INVALID_SCOPE_COPY : payload?.answer || "No response",
    ).trim();
    const words = fullText.split(/\s+/).filter(Boolean);
    const messageId = `assistant-${Date.now()}`;

    setStreaming(true);
    setMessages((prev) => [
      ...prev,
      createMessage("assistant", "", {
        id: messageId,
        skillGap: null,
        answerTitle: "",
        sections: [],
        nextSteps: [],
        followUpQuestions: [],
        contextFlags: payload?.contextFlags || {},
        answerMode: payload?.answerMode || "",
        invalidQuery,
      }),
    ]);

    let current = "";
    for (let index = 0; index < words.length; index += 1) {
      current = `${current}${index > 0 ? " " : ""}${words[index]}`;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId ? { ...message, content: current } : message,
        ),
      );
      await delay(index < 24 ? 18 : 10);
    }

    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content: fullText,
              skillGap: invalidQuery ? null : payload?.skillGap || null,
              answerTitle: invalidQuery ? "" : payload?.answerTitle || "",
              sections: invalidQuery ? [] : normalizeChatSections(payload?.sections),
              nextSteps: invalidQuery
                ? []
                : normalizeStructuredList(payload?.nextSteps),
              followUpQuestions: invalidQuery
                ? []
                : normalizeStructuredList(payload?.followUpQuestions, 3),
              contextFlags: payload?.contextFlags || {},
              answerMode: payload?.answerMode || "",
              invalidQuery,
            }
          : message,
      ),
    );
    setStreaming(false);
  };

  const sendMessage = async (prefilledQuestion = "") => {
    const question = (prefilledQuestion || input).trim();
    if (!question || thinking || streaming) {
      return;
    }

    const userMessage = createMessage("user", question);
    const history = normalizeHistory([...messages, userMessage]);

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setThinking(true);
    setWarning("");

    if (
      !isPlacementRelevantQuestion(question, {
        activeJobSnapshot: effectiveActiveJobSnapshot,
        resumeAnalysis: effectiveResumeAnalysis,
      })
    ) {
      setThinking(false);
      await streamAssistantMessage({ answerMode: "scope-redirect" });
      return;
    }

    try {
      const response = await askPlacementAssistant({
        question,
        history,
        selectedJobId: focusJobId || "",
        activeJobSnapshot: effectiveActiveJobSnapshot,
        resumeAnalysis: effectiveResumeAnalysis,
      });

      setThinking(false);
      setWarning(response?.warning || "");
      await streamAssistantMessage(response || {});
    } catch {
      setThinking(false);
      setMessages((prev) => [
        ...prev,
        createMessage(
          "assistant",
          "I couldn’t reach the placement assistant right now. Try again in a moment or use the Resume Analyzer for a full gap report.",
        ),
      ]);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-0 right-3 z-9999 flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-[#396CFF] via-[#6449F6] to-[#1EA0FF] text-white shadow-[0_18px_45px_rgba(67,97,238,0.35)] transition hover:scale-105"
        aria-label={
          open ? "Close AI placement assistant" : "Open AI placement assistant"
        }
      >
        <MessageCircle size={22} />
      </button>

      {open ? (
        <div
          className="fixed bottom-10 right-3 z-9999 flex h-[68vh] w-[90vw] max-w-90 flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)] sm:right-5 sm:h-120"
          style={{ fontFamily: "'Segoe UI', Inter, system-ui, sans-serif" }}
        >
          <div className="bg-linear-to-br from-[#6F62F4] via-[#6276F6] to-[#46A0F8] px-4 pb-3 pt-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-semibold tracking-tight">
                    Ask Placement Assistant
                  </h2>
                </div>
                <p className="mt-2 max-w-62.5 text-[12px] leading-5 text-blue-50">
                  Resume-aware guidance for skills, job fit, and interview prep.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
                aria-label="Minimize placement assistant"
              >
                <Minus size={16} />
              </button>
            </div>

          </div>

          <div className="flex-1 overflow-y-auto bg-white px-4 py-4">
            {warning ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-medium text-amber-700">
                {warning}
              </div>
            ) : null}

            {messages.length === 0 ? (
              <div className="pt-4">
                <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
                  Try one of these
                </h3>
                <p className="mt-1 text-[12px] leading-5 text-slate-500">
                  Quick prompts for resumes, interviews, skills, and placement preparation.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-2">
                  {STARTER_ACTIONS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => void sendMessage(item.prompt)}
                      className="w-full rounded-[14px] border border-[#9D69FF] bg-white px-3.5 py-3 text-left text-[13px] font-medium leading-5 text-slate-900 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.08)] transition hover:border-[#6B7BFF] hover:shadow-sm"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

              </div>
            ) : (
              <div className="space-y-4 pt-4">
                {messages.map((message) =>
                  message.role === "user" ? (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[82%] rounded-[14px] bg-slate-100 px-3.5 py-2.5 text-[13px] font-medium leading-6 text-slate-900 shadow-sm">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    <div key={message.id} className="flex items-start gap-3">
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#6B7BFF] to-[#45C2FF] text-white shadow-sm">
                        <Sparkles size={14} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="rounded-[14px] bg-white">
                          {!message.invalidQuery && message.answerTitle ? (
                            <div className="mb-2 inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                              {message.answerTitle}
                            </div>
                          ) : null}
                          <p className="whitespace-pre-wrap text-[13px] font-medium leading-7 text-slate-900">
                            {message.content}
                          </p>
                        </div>

                        {!message.invalidQuery && message.skillGap ? (
                          <SkillGapPanel skillGap={message.skillGap} />
                        ) : null}

                        {!message.invalidQuery &&
                        Array.isArray(message.sections) &&
                        message.sections.length > 0 ? (
                          <ChatInsightSections sections={message.sections} />
                        ) : null}

                        {!message.invalidQuery &&
                        Array.isArray(message.nextSteps) &&
                        message.nextSteps.length > 0 ? (
                          <ChatActionPlan
                            title="Next Steps"
                            items={message.nextSteps}
                          />
                        ) : null}

                        {!message.invalidQuery &&
                        Array.isArray(message.followUpQuestions) &&
                        message.followUpQuestions.length > 0 ? (
                          <FollowUpPromptBar
                            prompts={message.followUpQuestions}
                            onSelectPrompt={(prompt) => void sendMessage(prompt)}
                          />
                        ) : null}
                      </div>
                    </div>
                  ),
                )}

                {thinking ? (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#6B7BFF] to-[#45C2FF] text-white shadow-sm">
                      <Sparkles size={14} />
                    </div>

                    <div className="rounded-[14px] bg-white text-[12px] font-medium leading-6 text-slate-500">
                      <div className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Thinking about your profile, role fit, and next steps...
                      </div>
                    </div>
                  </div>
                ) : null}

                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white px-4 py-3">
            <div className="rounded-[14px] border border-slate-300 bg-white p-2 shadow-sm">
              <div className="flex items-center gap-2">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Ask a placement-related question..."
                  className="max-h-24 min-h-[34px] flex-1 resize-none bg-transparent px-2 py-1 text-[13px] font-medium text-slate-800 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || thinking || streaming}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-600 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {thinking || streaming ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

const SkillGapPanel = ({ skillGap }) => {
  const missingSkills = Array.isArray(skillGap?.missing_skills)
    ? skillGap.missing_skills
    : [];
  const matchedSkills = Array.isArray(skillGap?.matched_skills)
    ? skillGap.matched_skills
    : [];

  if (!missingSkills.length && !matchedSkills.length) {
    return null;
  }

  return (
    <div className="mt-3 rounded-[14px] border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold text-slate-900">
          Resume Gap Detection
        </p>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
          {skillGap?.skill_gap_percent || 0}% gap
        </span>
      </div>

      {matchedSkills.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-emerald-700">Matched</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {matchedSkills.slice(0, 5).map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {missingSkills.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-rose-700">Missing</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missingSkills.slice(0, 5).map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const ChatInsightSections = ({ sections }) => (
  <div className="mt-3 grid gap-3">
    {sections.map((section) => (
      <div
        key={section.title}
        className="rounded-[14px] border border-slate-200 bg-slate-50 p-3"
      >
        <p className="text-[12px] font-semibold text-slate-900">{section.title}</p>
        <div className="mt-2 space-y-2">
          {section.items.map((item) => (
            <div key={`${section.title}-${item}`} className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
              <p className="text-[11px] leading-5 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const ChatActionPlan = ({ title, items }) => (
  <div className="mt-3 rounded-[14px] border border-emerald-200 bg-emerald-50/70 p-3">
    <p className="text-[12px] font-semibold text-emerald-900">{title}</p>
    <div className="mt-2 space-y-2">
      {items.map((item, index) => (
        <div key={`${title}-${item}`} className="flex gap-2">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
            {index + 1}
          </span>
          <p className="text-[11px] leading-5 text-emerald-900">{item}</p>
        </div>
      ))}
    </div>
  </div>
);

const FollowUpPromptBar = ({ prompts, onSelectPrompt }) => (
  <div className="mt-3 rounded-[14px] border border-slate-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
    <p className="text-[12px] font-semibold text-slate-900">Ask Next</p>
    <div className="mt-2 flex flex-wrap gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onSelectPrompt?.(prompt)}
          className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-200"
        >
          {prompt}
        </button>
      ))}
    </div>
  </div>
);

export default ChatBot;
