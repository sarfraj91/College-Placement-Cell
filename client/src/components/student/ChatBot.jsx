import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  ExternalLink,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  Minus,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from "lucide-react";

import { askPlacementAssistant } from "../../services/chatbotApi.jsx";
import { applyToJob, getStudentJobs } from "../../services/jobApi.jsx";
import { readChatbotContext } from "../../utils/chatbotContext.js";


const STARTER_ACTIONS = [
  {
    label: "Review my resume gaps",
    prompt: "What are the biggest gaps in my resume for the selected job?",
  },
  {
    label: "Recommend jobs for my profile",
    prompt: "Recommend the best jobs for my current profile.",
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
  "Sorry, I can only answer questions related to placements, resumes, jobs, skills, and interviews.";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createMessage = (role, content = "", extra = {}) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  ...extra,
});

const normalizeSpeechTranscript = (value = "") =>
  String(value).replace(/\s+/g, " ").trim();

const getSpeechRecognitionConstructor = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

const hasSpeechSynthesisSupport = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

const resolveInternalJobStatus = (item, isApplying = false) => {
  if (item?.has_applied) {
    return {
      label: item?.application_status
        ? `Applied: ${item.application_status}`
        : "Applied",
      tone: "success",
      actionLabel: "Applied",
      disabled: true,
    };
  }

  if (item?.applications_closed) {
    return {
      label: "Closed",
      tone: "warn",
      actionLabel: "Applications Closed",
      disabled: true,
    };
  }

  if (isApplying) {
    return {
      label: "Applying",
      tone: "info",
      actionLabel: "Applying...",
      disabled: true,
    };
  }

  if (item?.can_apply) {
    return {
      label: "Can Apply",
      tone: "info",
      actionLabel: "Apply Now",
      disabled: false,
    };
  }

  return {
    label: item?.is_invited === false ? "Invite Required" : "View Only",
    tone: "neutral",
    actionLabel: "Not Allowed",
    disabled: true,
  };
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

const ChatBot = ({ selectedJobId = "", resumeAnalysis = null }) => {
  const storedContextRef = useRef(readChatbotContext());
  const recognitionRef = useRef(null);
  const spokenTranscriptRef = useRef("");
  const inputDraftRef = useRef("");
  const sendMessageRef = useRef(null);
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
  const [jobActionStatus, setJobActionStatus] = useState({
    type: "",
    message: "",
  });
  const [voiceStatus, setVoiceStatus] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceInputSupported, setVoiceInputSupported] = useState(false);
  const [voiceRepliesSupported, setVoiceRepliesSupported] = useState(false);
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState("");

  const bottomRef = useRef(null);

  const effectiveResumeAnalysis =
    resumeAnalysis || storedContextRef.current?.resumeAnalysis || null;
  const storedActiveJobSnapshot =
    storedContextRef.current?.activeJobSnapshot || null;

  useEffect(() => {
    inputDraftRef.current = input;
  }, [input]);

  useEffect(() => {
    const speechRecognition = getSpeechRecognitionConstructor();
    const speechPlayback = hasSpeechSynthesisSupport();

    setVoiceInputSupported(Boolean(speechRecognition));
    setVoiceRepliesSupported(speechPlayback);
    setVoiceRepliesEnabled(speechPlayback);

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }

      if (speechPlayback) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedJobId) {
      setFocusJobId(selectedJobId);
    }
  }, [selectedJobId]);

  useEffect(() => {
    if (open) {
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onresult = null;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    setListening(false);

    if (hasSpeechSynthesisSupport()) {
      window.speechSynthesis.cancel();
    }
  }, [open]);

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

  const statusFlags = {
    resumeAware: Boolean(
      effectiveResumeAnalysis?.resumeSkills?.length ||
        effectiveResumeAnalysis?.resume_skills?.length,
    ),
    jobAware: Boolean(focusJobId || effectiveActiveJobSnapshot?.jobTitle),
  };

  const stopSpeechPlayback = () => {
    if (hasSpeechSynthesisSupport()) {
      window.speechSynthesis.cancel();
    }
  };

  const speakAssistantReply = (text) => {
    if (!voiceRepliesEnabled || !voiceRepliesSupported) {
      return;
    }

    const message = normalizeSpeechTranscript(text);
    if (!message) {
      return;
    }

    stopSpeechPlayback();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "en-IN";
    utterance.rate = 1;
    utterance.pitch = 1;

    const availableVoices = window.speechSynthesis.getVoices();
    const preferredVoice =
      availableVoices.find((voice) =>
        String(voice.lang || "").toLowerCase().startsWith("en-in"),
      ) ||
      availableVoices.find((voice) =>
        String(voice.lang || "").toLowerCase().startsWith("en"),
      );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  const updateRecommendedJobState = (jobId, updates = {}) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (!Array.isArray(message.recommendedJobs) || !message.recommendedJobs.length) {
          return message;
        }

        const hasTargetJob = message.recommendedJobs.some(
          (job) => job.job_id === jobId,
        );

        if (!hasTargetJob) {
          return message;
        }

        return {
          ...message,
          recommendedJobs: message.recommendedJobs.map((job) =>
            job.job_id === jobId ? { ...job, ...updates } : job,
          ),
        };
      }),
    );

    setJobs((prev) =>
      prev.map((job) =>
        job._id === jobId
          ? {
              ...job,
              hasApplied: updates.has_applied ?? job.hasApplied,
              canApply: updates.can_apply ?? job.canApply,
              applicationsClosed:
                updates.applications_closed ?? job.applicationsClosed,
            }
          : job,
      ),
    );
  };

  const handleApplyRecommendation = async (job) => {
    if (!job?.job_id) {
      return;
    }

    setApplyingJobId(job.job_id);
    setJobActionStatus({ type: "", message: "" });

    try {
      const response = await applyToJob(job.job_id);
      const applicationStatus =
        response?.data?.application?.status || "applied";

      updateRecommendedJobState(job.job_id, {
        has_applied: true,
        can_apply: false,
        application_status: applicationStatus,
      });

      setJobActionStatus({
        type: "success",
        message: `Applied to ${job.job_title} successfully.`,
      });
    } catch (error) {
      setJobActionStatus({
        type: "error",
        message:
          error?.response?.data?.message ||
          `Failed to apply to ${job?.job_title || "this job"}.`,
      });
    } finally {
      setApplyingJobId("");
    }
  };

  const startVoiceCapture = () => {
    if (thinking || streaming) {
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setVoiceStatus("Voice input is not supported in this browser.");
      return;
    }

    stopSpeechPlayback();

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onresult = null;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    spokenTranscriptRef.current = "";

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setVoiceStatus("Listening... speak your question.");
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = normalizeSpeechTranscript(
          event.results[index]?.[0]?.transcript || "",
        );

        if (!transcript) {
          continue;
        }

        if (event.results[index].isFinal) {
          finalTranscript = normalizeSpeechTranscript(
            `${finalTranscript} ${transcript}`,
          );
        } else {
          interimTranscript = normalizeSpeechTranscript(
            `${interimTranscript} ${transcript}`,
          );
        }
      }

      if (finalTranscript) {
        spokenTranscriptRef.current = finalTranscript;
      }

      setInput(
        normalizeSpeechTranscript(
          `${spokenTranscriptRef.current} ${interimTranscript}`,
        ),
      );
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setVoiceStatus("Microphone permission is blocked in this browser.");
      } else if (event.error === "no-speech") {
        setVoiceStatus("No speech detected. Try again and speak closer to the mic.");
      } else {
        setVoiceStatus("Voice capture stopped. Try again.");
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);

      const spokenQuestion = normalizeSpeechTranscript(
        spokenTranscriptRef.current || inputDraftRef.current,
      );

      if (!spokenQuestion) {
        setVoiceStatus("Voice capture stopped.");
        return;
      }

      setVoiceStatus("Voice captured. Sending your question...");
      setInput("");
      void sendMessageRef.current?.(spokenQuestion);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setVoiceStatus("Unable to start voice capture right now.");
    }
  };

  const toggleVoiceCapture = () => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    startVoiceCapture();
  };

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
        recommendedJobs: [],
        externalJobs: [],
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
              recommendedJobs: invalidQuery
                ? []
                : payload?.recommendedJobs || [],
              externalJobs: invalidQuery ? [] : payload?.externalJobs || [],
              contextFlags: payload?.contextFlags || {},
              answerMode: payload?.answerMode || "",
              invalidQuery,
            }
          : message,
      ),
    );
    setStreaming(false);

    if (voiceRepliesEnabled) {
      speakAssistantReply(fullText);
    }
  };

  const sendMessage = async (prefilledQuestion = "") => {
    const question = (prefilledQuestion || input).trim();
    if (!question || thinking || streaming) {
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setListening(false);
    }

    stopSpeechPlayback();

    const userMessage = createMessage("user", question);
    const history = normalizeHistory([...messages, userMessage]);

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setThinking(true);
    setWarning("");
    setJobActionStatus({ type: "", message: "" });
    setVoiceStatus("");

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

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    if (!voiceRepliesEnabled && hasSpeechSynthesisSupport()) {
      window.speechSynthesis.cancel();
    }
  }, [voiceRepliesEnabled]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-4 right-4 z-9999 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-[#396CFF] via-[#6449F6] to-[#1EA0FF] text-white shadow-[0_18px_45px_rgba(67,97,238,0.35)] transition hover:scale-105"
        aria-label={
          open ? "Close AI placement assistant" : "Open AI placement assistant"
        }
      >
        <MessageCircle size={22} />
      </button>

      {open ? (
        <div
          className="fixed bottom-21 right-3 z-9999 flex h-[68vh] w-[90vw] max-w-90 flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)] sm:right-5 sm:h-120"
          style={{ fontFamily: "'Segoe UI', Inter, system-ui, sans-serif" }}
        >
          <div className="bg-linear-to-br from-[#6F62F4] via-[#6276F6] to-[#46A0F8] px-4 pb-3 pt-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-semibold tracking-tight">
                    Ask Placement Assistant
                  </h2>
                  <span className="rounded-full border border-white/35 bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white">
                    built-in
                  </span>
                </div>
                <p className="mt-2 max-w-[250px] text-[12px] leading-5 text-blue-50">
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

            {/* <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusPill active label="Product-ready" />
              <StatusPill
                active={statusFlags.resumeAware}
                label="Resume-aware"
              />
              <StatusPill active={statusFlags.jobAware} label="Job-aware" />
              <StatusPill
                active={voiceInputSupported}
                label={listening ? "Listening" : "Voice input"}
              />
              {voiceRepliesSupported ? (
                <button
                  type="button"
                  onClick={() => setVoiceRepliesEnabled((prev) => !prev)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                    voiceRepliesEnabled
                      ? "border-white/25 bg-white/20 text-white"
                      : "border-white/20 bg-white/10 text-blue-100"
                  }`}
                  aria-label={
                    voiceRepliesEnabled
                      ? "Disable spoken chatbot replies"
                      : "Enable spoken chatbot replies"
                  }
                >
                  {voiceRepliesEnabled ? <Volume2 size={11} /> : <VolumeX size={11} />}
                  {voiceRepliesEnabled ? "Voice replies on" : "Voice replies off"}
                </button>
              ) : null}
            </div> */}
          </div>

          <div className="flex-1 overflow-y-auto bg-white px-4 py-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <Target size={14} className="shrink-0 text-slate-500" />
                <select
                  value={focusJobId}
                  onChange={(event) => setFocusJobId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 outline-none focus:border-blue-500"
                >
                  <option value="">General placement guidance</option>
                  {jobs.map((job) => (
                    <option key={job._id} value={job._id}>
                      {job.jobTitle} - {job.company?.name || "Company"}
                    </option>
                  ))}
                </select>
              </div>

              {statusFlags.resumeAware ? (
                <p className="mt-2 text-[12px] font-medium leading-5 text-emerald-600">
                  Resume gap analysis is connected for more personalized answers.
                </p>
              ) : (
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  Run the{" "}
                  <Link
                    to="/student/resume-analyzer"
                    className="font-semibold text-blue-600"
                  >
                    Resume Analyzer
                  </Link>{" "}
                  once to unlock stronger gap detection.
                </p>
              )}
            </div>

            {warning ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-medium text-amber-700">
                {warning}
              </div>
            ) : null}

            {jobActionStatus.message ? (
              <div
                className={`mt-3 rounded-2xl border px-4 py-3 text-[11px] font-medium ${
                  jobActionStatus.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {jobActionStatus.message}
              </div>
            ) : null}

            {voiceStatus ? (
              <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-[11px] font-medium text-sky-700">
                {voiceStatus}
              </div>
            ) : null}

            {messages.length === 0 ? (
              <div className="pt-4">
                <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
                  Try one of these
                </h3>
                <p className="mt-1 text-[12px] leading-5 text-slate-500">
                  Quick prompts for resume, jobs, interviews, and role skills.
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

                <p className="mt-8 text-center text-[11px] leading-5 text-slate-400">
                  By chatting, you agree to this{" "}
                  <span className="font-medium text-blue-600 underline underline-offset-2">
                    disclaimer
                  </span>
                  .
                </p>
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
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6B7BFF] to-[#45C2FF] text-white shadow-sm">
                        <Sparkles size={14} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="rounded-[14px] bg-white">
                          <p className="whitespace-pre-wrap text-[13px] font-medium leading-7 text-slate-900">
                            {message.content}
                          </p>
                        </div>

                        {message.invalidQuery ? (
                          <div className="mt-3 flex items-center gap-3 text-slate-400">
                            <button
                              type="button"
                              className="transition hover:text-slate-600"
                              aria-label="Helpful response"
                            >
                              <ThumbsUp size={18} />
                            </button>
                            <button
                              type="button"
                              className="transition hover:text-slate-600"
                              aria-label="Unhelpful response"
                            >
                              <ThumbsDown size={18} />
                            </button>
                          </div>
                        ) : null}

                        {!message.invalidQuery && message.skillGap ? (
                          <SkillGapPanel skillGap={message.skillGap} />
                        ) : null}

                        {!message.invalidQuery &&
                        Array.isArray(message.recommendedJobs) &&
                        message.recommendedJobs.length > 0 ? (
                          <RecommendationPanel
                            title="Recommended Jobs"
                            items={message.recommendedJobs}
                            internal
                            applyingJobId={applyingJobId}
                            onApplyInternalJob={handleApplyRecommendation}
                          />
                        ) : null}

                        {!message.invalidQuery &&
                        Array.isArray(message.externalJobs) &&
                        message.externalJobs.length > 0 ? (
                          <RecommendationPanel
                            title="External Leads"
                            items={message.externalJobs}
                            applyingJobId={applyingJobId}
                          />
                        ) : null}
                      </div>
                    </div>
                  ),
                )}

                {thinking ? (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6B7BFF] to-[#45C2FF] text-white shadow-sm">
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
                  placeholder="Ask your question..."
                  className="max-h-24 min-h-[34px] flex-1 resize-none bg-transparent px-2 py-1 text-[13px] font-medium text-slate-800 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={toggleVoiceCapture}
                  disabled={!voiceInputSupported || thinking || streaming}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    listening
                      ? "bg-rose-100 text-rose-600 hover:bg-rose-200"
                      : "bg-sky-100 text-sky-600 hover:bg-sky-200"
                  }`}
                  aria-label={
                    listening
                      ? "Stop voice input"
                      : "Start voice input"
                  }
                >
                  {listening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
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

              <div className="mt-2 flex flex-wrap items-center gap-2 px-2 text-[11px] font-medium">
                <span className="text-slate-500">
                  {voiceInputSupported
                    ? listening
                      ? "Listening now. Stop the mic to send."
                      : "Tap the mic to ask by voice."
                    : "Voice input works in supported browsers like Chrome and Edge."}
                </span>
                {voiceRepliesSupported ? (
                  <span className="text-sky-600">
                    {voiceRepliesEnabled
                      ? "Spoken replies are enabled."
                      : "Spoken replies are muted."}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

const StatusPill = ({ active, label }) => (
  <span
    className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
      active
        ? "border border-white/25 bg-white/20 text-white"
        : "border border-white/20 bg-white/10 text-blue-100"
    }`}
  >
    {label}
  </span>
);

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

const RecommendationPanel = ({
  title,
  items,
  internal = false,
  applyingJobId = "",
  onApplyInternalJob,
}) => (
  <div className="mt-3 rounded-[14px] border border-slate-200 bg-slate-50 p-3">
    <div className="mb-3 flex items-center gap-2">
      <Briefcase size={13} className="text-blue-600" />
      <p className="text-[12px] font-semibold text-slate-900">{title}</p>
    </div>

    <div className="space-y-3">
      {items.slice(0, 3).map((item) => {
        const internalJobStatus = internal
          ? resolveInternalJobStatus(item, applyingJobId === item.job_id)
          : null;
        const internalJobLink =
          item.view_url || (item.job_id ? `/student/jobs/${item.job_id}` : "");

        return (
          <div
            key={`${item.job_id || item.job_title}-${item.source || "internal"}`}
            className="rounded-[14px] border border-slate-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {internal && internalJobLink ? (
                  <Link
                    to={internalJobLink}
                    className="text-[13px] font-semibold leading-5 text-slate-900 transition hover:text-blue-600"
                  >
                    {item.job_title}
                  </Link>
                ) : item.apply_url ? (
                  <a
                    href={item.apply_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] font-semibold leading-5 text-slate-900 transition hover:text-blue-600"
                  >
                    {item.job_title}
                  </a>
                ) : (
                  <p className="text-[13px] font-semibold leading-5 text-slate-900">
                    {item.job_title}
                  </p>
                )}

                <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
                  {item.company || item.source || "Opportunity"}
                  {item.location ? ` | ${item.location}` : ""}
                </p>
              </div>

              {internalJobStatus ? (
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                    internalJobStatus.tone === "success"
                      ? "bg-emerald-100 text-emerald-700"
                      : internalJobStatus.tone === "warn"
                        ? "bg-amber-100 text-amber-700"
                        : internalJobStatus.tone === "info"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {internalJobStatus.label}
                </span>
              ) : item.source ? (
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                  {item.source}
                </span>
              ) : null}
            </div>

            {item.reason ? (
              <p className="mt-2 text-[11px] leading-5 text-slate-600">
                {item.reason}
              </p>
            ) : null}

            {Array.isArray(item.matched_skills) &&
            item.matched_skills.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {item.matched_skills.slice(0, 3).map((skill) => (
                  <span
                    key={`${item.job_title}-${skill}`}
                    className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {internal && internalJobLink ? (
                <Link
                  to={internalJobLink}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  View Job
                </Link>
              ) : null}

              {internal ? (
                <button
                  type="button"
                  onClick={() => onApplyInternalJob?.(item)}
                  disabled={internalJobStatus?.disabled || !item.job_id}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  {internalJobStatus?.actionLabel || "Apply"}
                </button>
              ) : item.apply_url ? (
                <a
                  href={item.apply_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-blue-700"
                >
                  {item.action_label || "Search & Apply"}
                  <ExternalLink size={12} />
                </a>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default ChatBot;
