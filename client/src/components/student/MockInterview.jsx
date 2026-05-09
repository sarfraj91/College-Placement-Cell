import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCcw,
  Sparkles,
  Mic,
  ShieldAlert,
  ShieldCheck,
  Video,
  Volume2,
  Wifi,
  XCircle,
} from "lucide-react";

import InterviewCore from "./InterviewCore";
import ParticleMesh from "../ui/ParticleMesh.jsx";
import { startMockInterview } from "../../services/interviewQaApi.jsx";
import { cancelSpeech, speakText } from "../../utils/speechPlayback.js";
import "./MockInterview.css";

const ENGLISH_OPTIONS = ["basic", "medium", "advanced"];
const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"];
const QUESTION_COUNT_OPTIONS = [4, 5, 6];
const MIC_CHECK_PHRASE = "I am ready to start the interview.";
const createNetworkState = () => ({
  status: "idle",
  title: "Internet speed",
  detail: "We will test your connection before the interview begins.",
  meta: "Pending",
});
const formatDuration = (seconds = 0) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

const formatLabel = (value = "") =>
  value
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const stopMediaStream = (stream) => {
  stream?.getTracks?.().forEach((track) => track.stop());
};

const createFallbackInterviewResult = ({
  answeredQuestions = 0,
  totalQuestions = 0,
  elapsedSeconds = 0,
  role = "",
  difficulty = "",
  englishLevel = "",
  message = "",
  proctorFlags = [],
  serviceUnavailable = false,
}) => {
  const integrityNote = proctorFlags.length
    ? `Integrity signals were raised ${proctorFlags.length} time(s). Review focus changes, camera framing, and movement before your next attempt.`
    : "";

  if (!answeredQuestions) {
    return {
      summary:
        "The interview ended before enough answers were captured to generate a detailed evaluation. Stay for at least one full answer next time so the report can measure your communication and technical depth.",
      strengths: [
        "You completed the setup flow and entered the live interview environment successfully.",
      ],
      improvements: [
        "Stay through the first question so the report can generate role-specific coaching.",
        "Stay on the interview tab and keep your camera centered from start to finish.",
        "Use concrete project examples when you begin answering the interviewer.",
      ],
      overallScore: null,
      communicationScore: null,
      technicalScore: null,
      confidenceScore: null,
      integrityNote,
      fallbackUsed: true,
      message,
      answeredQuestions,
      totalQuestions,
      elapsedSeconds,
      role,
      difficulty,
      englishLevel,
    };
  }

  return {
    summary: serviceUnavailable
      ? "The interview ended safely, but the detailed AI report was unavailable. Use the notes below as a practical improvement plan for your next attempt."
      : "The interview ended before a full AI report could be generated, so this fallback summary focuses on the clearest next improvements.",
    strengths: [
      answeredQuestions >= totalQuestions
        ? "You stayed with the session through the planned set of questions."
        : "You progressed through the live interview and submitted responses in the interview flow.",
      "You completed the interview inside the monitored environment with camera and microphone active.",
    ],
    improvements: [
      "Use one concrete project example in every answer so your impact is easy to follow.",
      "Explain the tradeoff behind your decisions, not just the steps you took.",
      "Keep your answers structured with situation, action, and outcome.",
    ],
    overallScore: null,
    communicationScore: null,
    technicalScore: null,
    confidenceScore: null,
    integrityNote,
    hiringSignal: answeredQuestions
      ? "Promising practice signal with room to become more concrete and decisive."
      : "Too little answer data to form a reliable hiring signal.",
    communicationSummary:
      "Communication improves when answers reach the example faster and end with a clear result.",
    technicalSummary:
      "Technical strength is easier to see when you explain the why behind your decisions.",
    confidenceSummary:
      "Confidence rises when you use ownership language and close with impact.",
    nextSteps: [
      "Prepare 3 resume-backed stories with context, action, result, and tradeoff.",
      "Practice one debugging answer and one design answer aloud.",
      "Tighten your opening so the real example comes earlier.",
    ],
    fallbackUsed: true,
    message,
    answeredQuestions,
    totalQuestions,
    elapsedSeconds,
    role,
    difficulty,
    englishLevel,
  };
};

const StatusPill = ({ status }) => {
  const label =
    status === "ready"
      ? "Ready"
      : status === "checking"
        ? "Checking"
        : status === "warning"
          ? "Attention"
          : "Blocked";

  const icon =
    status === "ready" ? (
      <CheckCircle2 size={14} />
    ) : status === "checking" ? (
      <Loader2 size={14} className="animate-spin" />
    ) : status === "warning" ? (
      <AlertTriangle size={14} />
    ) : (
      <XCircle size={14} />
    );

  return (
    <span className={`mock-status-pill is-${status}`}>
      {icon}
      {label}
    </span>
  );
};

const DeviceRow = ({ icon, title, description, status, action }) => (
  <div className="mock-check-line">
    <div className="mock-check-line__main">
      <div className="mock-check-line__icon">{icon}</div>
      <div className="mock-check-line__copy">
        <div className="mock-check-line__head">
          <p className="mock-check-line__title">{title}</p>
          <StatusPill status={status} />
        </div>
        <p className="mock-check-line__detail">{description}</p>
      </div>
    </div>
    <div className="mock-check-line__actions">{action}</div>
  </div>
);

const ScoreCard = ({ label, value, tone = "default" }) => (
  <article className={`mock-result-score-card is-${tone}`}>
    <span className="mock-result-score-card__label">{label}</span>
    <strong className="mock-result-score-card__value">
      {Number.isFinite(value) ? `${Math.round(value)}%` : "--"}
    </strong>
  </article>
);

const ResultList = ({ title, items, tone = "positive" }) => (
  <section className={`mock-result-list is-${tone}`}>
    <div className="mock-result-list__head">
      <p className="mock-section-kicker">{title}</p>
      <span className="mock-card-tag">
        {tone === "positive" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
        {tone === "positive" ? "Strengths" : "Suggestions"}
      </span>
    </div>

    <div className="mock-result-list__body">
      {(items || []).map((item) => (
        <div key={item} className="mock-result-list__item">
          {tone === "positive" ? <CheckCircle2 size={16} /> : <Sparkles size={16} />}
          <span>{item}</span>
        </div>
      ))}
    </div>
  </section>
);

const FLOW_STEPS = [
  {
    id: "briefing",
    label: "Briefing",
    hint: "Resume and session setup",
  },
  {
    id: "system",
    label: "System Check",
    hint: "Camera, mic, speaker, network",
  },
  {
    id: "security",
    label: "Security Gate",
    hint: "Anti-cheat agreement",
  },
  {
    id: "live",
    label: "Live Interview",
    hint: "Guided question flow",
  },
  {
    id: "results",
    label: "Results",
    hint: "Scores and coaching",
  },
];

const FlowStepper = ({ activeStep, compact = false }) => {
  const activeIndex = Math.max(
    FLOW_STEPS.findIndex((step) => step.id === activeStep),
    0,
  );

  return (
    <section className={`mock-surface mock-flow-bar${compact ? " is-compact" : ""}`}>
      {FLOW_STEPS.map((step, index) => {
        const state =
          index < activeIndex ? "complete" : index === activeIndex ? "active" : "upcoming";

        return (
          <div key={step.id} className={`mock-flow-step is-${state}`}>
            <span className="mock-flow-step__index">
              {state === "complete" ? <CheckCircle2 size={14} /> : index + 1}
            </span>
            <div className="mock-flow-step__copy">
              <strong className="mock-flow-step__label">{step.label}</strong>
              <span className="mock-flow-step__hint">{step.hint}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
};

const MockInterview = () => {
  const previewVideoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micFrameRef = useRef(null);
  const setupRecognitionRef = useRef(null);

  const [setupStage, setSetupStage] = useState("briefing");
  const [resumeFile, setResumeFile] = useState(null);
  const [englishLevel, setEnglishLevel] = useState("medium");
  const [difficulty, setDifficulty] = useState("medium");
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [speakerConfirmed, setSpeakerConfirmed] = useState(false);
  const [preparingInterview, setPreparingInterview] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [notice, setNotice] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [mediaStream, setMediaStream] = useState(null);
  const [session, setSession] = useState(null);
  const [interviewResult, setInterviewResult] = useState(null);
  const [networkState, setNetworkState] = useState(createNetworkState);
  const [micCheckListening, setMicCheckListening] = useState(false);
  const [micCheckTranscript, setMicCheckTranscript] = useState("");
  const [micPhraseVerified, setMicPhraseVerified] = useState(false);
  const [deviceState, setDeviceState] = useState({
    browserReady:
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
    speechSynthesisReady:
      typeof window !== "undefined" && "speechSynthesis" in window,
    speechRecognitionReady:
      typeof window !== "undefined" &&
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    cameraReady: false,
    microphoneReady: false,
    permissionsRequested: false,
  });

  const durationLabel = useMemo(() => {
    const minimum = totalQuestions * 2 + 2;
    const maximum = totalQuestions * 2 + 4;
    return `${minimum}-${maximum} minutes`;
  }, [totalQuestions]);

  const clearLiveSessionState = () => {
    stopSetupRecognition();
    stopAudioMonitor();
    stopMediaStream(mediaStream);
    cancelSpeech();

    setMediaStream(null);
    setSession(null);
    setSecurityModalOpen(false);
    setPreparingInterview(false);
    setSpeakerConfirmed(false);
    setMicCheckListening(false);
    setMicCheckTranscript("");
    setMicPhraseVerified(false);
    setNetworkState(createNetworkState());
    setDeviceState((previous) => ({
      ...previous,
      cameraReady: false,
      microphoneReady: false,
      permissionsRequested: false,
    }));
  };

  const stopSetupRecognition = () => {
    setupRecognitionRef.current?.stop?.();
    setupRecognitionRef.current = null;
    setMicCheckListening(false);
  };

  const stopAudioMonitor = () => {
    if (micFrameRef.current) {
      cancelAnimationFrame(micFrameRef.current);
      micFrameRef.current = null;
    }

    analyserRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setMicLevel(0);
  };

  const resetInterviewFlow = (nextNotice = "") => {
    clearLiveSessionState();
    setSetupStage("briefing");
    setInterviewResult(null);
    setSecurityModalOpen(false);
    setPreparingInterview(false);
    setSetupError("");
    setNotice(nextNotice);
  };

  const handleInterviewComplete = async (resultPayload) => {
    clearLiveSessionState();
    setInterviewResult(resultPayload);
    setSetupStage("briefing");
    setSetupError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const startAudioMonitor = (stream) => {
    stopAudioMonitor();

    const AudioContextCtor =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextCtor) {
      setDeviceState((previous) => ({
        ...previous,
        microphoneReady: Boolean(stream.getAudioTracks().length),
      }));
      return;
    }

    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 256;
    source.connect(analyser);

    const samples = new Uint8Array(analyser.frequencyBinCount);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const tick = () => {
      analyser.getByteFrequencyData(samples);
      const average =
        samples.reduce((sum, item) => sum + item, 0) /
        Math.max(samples.length, 1);
      const normalizedLevel = average / 255;

      setMicLevel(normalizedLevel);

      if (normalizedLevel > 0.03) {
        setDeviceState((previous) => ({
          ...previous,
          microphoneReady: true,
        }));
      }

      micFrameRef.current = requestAnimationFrame(tick);
    };

    audioContext.resume().catch(() => {});
    tick();
  };

  const attachPreview = async (stream) => {
    if (!previewVideoRef.current || !stream) {
      return;
    }

    previewVideoRef.current.srcObject = stream;

    try {
      await previewVideoRef.current.play();
    } catch {
      // Ignore autoplay issues; the stream is still available.
    }
  };

  const refreshPermissionHints = async () => {
    if (!navigator.permissions?.query) {
      return;
    }

    try {
      const [cameraPermission, microphonePermission] = await Promise.all([
        navigator.permissions.query({ name: "camera" }),
        navigator.permissions.query({ name: "microphone" }),
      ]);

      setNotice(
        `Camera permission: ${cameraPermission.state}. Microphone permission: ${microphonePermission.state}.`,
      );
    } catch {
      // Permission query support is browser-dependent.
    }
  };

  const runNetworkCheck = async () => {
    if (typeof window === "undefined") {
      return;
    }

    setNetworkState({
      status: "checking",
      title: "Checking internet speed",
      detail: "Testing your connection quality for a stable live interview...",
      meta: "Running test",
    });

    if (navigator.onLine === false) {
      setNetworkState({
        status: "error",
        title: "Internet unavailable",
        detail: "Your browser says you are offline. Reconnect before starting the interview.",
        meta: "Offline",
      });
      return;
    }

    const connection =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const downlink = Number(connection?.downlink || 0);
    const effectiveType = String(connection?.effectiveType || "").trim();

    let latency = 0;

    try {
      const start = performance.now();
      await fetch(`${window.location.origin}/?mockInterviewPing=${Date.now()}`, {
        cache: "no-store",
      });
      latency = Math.round(performance.now() - start);
    } catch {
      latency = 0;
    }

    if (!downlink && !latency) {
      setNetworkState({
        status: "warning",
        title: "Internet speed check limited",
        detail:
          "This browser exposes limited network details. Continue only if your internet is stable.",
        meta: "Browser-limited measurement",
      });
      return;
    }

    let status = "ready";
    let detail = "Connection looks stable for live audio, video, and speech responses.";

    if ((downlink && downlink < 0.35) || (latency && latency > 2500)) {
      status = "warning";
      detail =
        "Connection looks weak, but you can still continue if your audio and video preview stay stable.";
    } else if ((downlink && downlink < 0.8) || (latency && latency > 1400)) {
      status = "warning";
      detail =
        "Connection looks usable, but weaker network quality may affect the interview flow.";
    }

    const meta = [
      downlink ? `${downlink.toFixed(1)} Mbps` : "",
      effectiveType || "",
      latency ? `${latency} ms latency` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    setNetworkState({
      status,
      title: status === "ready" ? "Internet speed verified" : "Internet check completed",
      detail,
      meta: meta || "Measured",
    });
  };

  const requestPermissions = async () => {
    if (!deviceState.browserReady) {
      setSetupError(
        "This browser does not support camera and microphone access for the mock interview.",
      );
      return;
    }

    try {
      setSetupError("");
      setNotice("");

      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      stopMediaStream(mediaStream);
      setMediaStream(nextStream);
      setDeviceState((previous) => ({
        ...previous,
        permissionsRequested: true,
        cameraReady: Boolean(nextStream.getVideoTracks().length),
        microphoneReady: Boolean(nextStream.getAudioTracks().length),
      }));
      setNotice(
        "Camera and microphone access granted. Say a few words to confirm the mic meter is moving, then run the speaker test.",
      );

      await attachPreview(nextStream);
      startAudioMonitor(nextStream);
      await refreshPermissionHints();
    } catch (error) {
      setSetupError(
        error?.message ||
          "Unable to access camera and microphone. Please allow both permissions and try again.",
      );
    }
  };

  const playSpeakerSample = () => {
    if (!deviceState.speechSynthesisReady) {
      setSetupError(
        "Speech playback is not supported in this browser, so the speaker test cannot run here.",
      );
      return;
    }

    setSetupError("");
    setNotice("Listen for the sample voice, then confirm that you heard it.");
    void speakText(
      "This is your mock interview speaker test. If you can hear this clearly, confirm the sound check and start the interview.",
    );
  };

  const beginMicCheck = () => {
    if (!mediaStream) {
      setSetupError("Enable your camera and microphone first.");
      return;
    }

    if (!deviceState.speechRecognitionReady) {
      if (deviceState.microphoneReady || micLevel > 0.03) {
        setMicPhraseVerified(true);
        setMicCheckTranscript("Microphone activity detected. Manual mic check accepted.");
        setNotice(
          "Voice recognition is unavailable here, so microphone activity was used for the check.",
        );
        return;
      }

      setSetupError("Say a few words first so the microphone activity meter can detect your voice.");
      return;
    }

    setSetupError("");
    setNotice("Speak the phrase exactly once so we can validate your microphone.");
    setMicCheckTranscript("");
    stopSetupRecognition();

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new RecognitionCtor();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.onresult = (event) => {
      const transcript = [];

      for (let index = 0; index < event.results.length; index += 1) {
        transcript.push(event.results[index][0].transcript);
      }

      const joinedTranscript = transcript.join(" ").trim();
      const normalizedTranscript = joinedTranscript
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ");

      setMicCheckTranscript(joinedTranscript);

      if (
        normalizedTranscript.includes("ready") &&
        normalizedTranscript.includes("interview")
      ) {
        setMicPhraseVerified(true);
        setNotice("Microphone phrase verified. You are ready for the interview stage.");
        recognition.stop();
      }
    };
    recognition.onerror = () => {
      setSetupError("Voice phrase capture failed. You can try the mic check again.");
      setMicCheckListening(false);
      setupRecognitionRef.current = null;
    };
    recognition.onend = () => {
      setMicCheckListening(false);
      setupRecognitionRef.current = null;
    };
    recognition.start();
    setupRecognitionRef.current = recognition;
    setMicCheckListening(true);
  };

  const handleResumeChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setSetupError("");

    if (!nextFile) {
      setResumeFile(null);
      return;
    }

    const isPdf =
      nextFile.type === "application/pdf" ||
      nextFile.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setResumeFile(null);
      setSetupError("Please upload a PDF resume only.");
      return;
    }

    setResumeFile(nextFile);
  };

  const goToSystemCheck = () => {
    if (!resumeFile) {
      setSetupError("Upload your resume PDF first.");
      return;
    }

    if (!rulesAccepted) {
      setSetupError("Accept the interview rules and anti-cheat instructions first.");
      return;
    }

    setSetupError("");
    setSetupStage("system");
  };

  const readyToStart =
    resumeFile &&
    rulesAccepted &&
    mediaStream &&
    speakerConfirmed &&
    deviceState.cameraReady &&
    deviceState.microphoneReady &&
    (micPhraseVerified || !deviceState.speechRecognitionReady) &&
    deviceState.browserReady &&
    ["ready", "warning"].includes(networkState.status);

  const openSecurityGate = () => {
    if (!readyToStart) {
      setSetupError("Complete the camera, microphone, speaker, and network checks before continuing.");
      return;
    }

    setSetupError("");
    setSecurityModalOpen(true);
  };

  const handleStartInterview = async () => {
    try {
      setPreparingInterview(true);
      setSecurityModalOpen(false);
      setSetupError("");
      setNotice("");
      setInterviewResult(null);

      const data = await startMockInterview({
        resumeFile,
        difficulty,
        englishLevel,
        totalQuestions,
      });

      setSession({
        role: data?.role || "full stack",
        difficulty,
        englishLevel,
        totalQuestions: Number(data?.totalQuestions ?? totalQuestions) || totalQuestions,
        opening: data?.opening || "",
        question: data?.question || "",
        interviewerStyle: data?.interviewerStyle || "",
        candidateBrief: data?.candidateBrief || "",
        focusAreas: Array.isArray(data?.focusAreas) ? data.focusAreas : [],
        profile: data?.profile || null,
        warning: data?.warning || "",
      });
      setNotice(data?.warning || "");
    } catch (error) {
      setSetupError(
        error?.response?.data?.message ||
          "Unable to start the mock interview right now.",
      );
    } finally {
      setPreparingInterview(false);
    }
  };

  useEffect(() => {
    if (setupStage === "system" && networkState.status === "idle") {
      void runNetworkCheck();
    }
  }, [setupStage, networkState.status]);

  useEffect(() => {
    if (mediaStream) {
      void attachPreview(mediaStream);
    }
  }, [mediaStream]);

  useEffect(() => {
    if (setupStage !== "system") {
      stopSetupRecognition();
    }
  }, [setupStage]);

  useEffect(
    () => () => {
      stopSetupRecognition();
      stopAudioMonitor();
      stopMediaStream(mediaStream);
      cancelSpeech();
    },
    [mediaStream],
  );

  const renderBriefingStage = () => (
    <motion.div
      key="briefing"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="mock-stage-stack"
    >
      <FlowStepper activeStep="briefing" />

      <section className="mock-surface mock-hero-card">
        <div className="mock-hero-copy">
          <p className="mock-greeting">Hi there!</p>
          <h1 className="mock-hero-title">Welcome to your AI Interview</h1>
          <p className="mock-hero-subtitle">
            This works like a real interview flow: briefing, system checks,
            security verification, then a live resume-aware conversation.
          </p>
        </div>
        <div className="mock-hero-step">Stage 1 of 5</div>
      </section>

      <section className="mock-surface mock-briefing-card">
        <div className="mock-briefing-header">
          <div>
            <p className="mock-section-kicker">Interview Brief</p>
            <h2 className="mock-section-title">Before you begin</h2>
          </div>
          <div className="mock-chip-row">
            <span className="mock-chip">Resume-aware interview</span>
            <span className="mock-chip">English: {formatLabel(englishLevel)}</span>
            <span className="mock-chip">Difficulty: {formatLabel(difficulty)}</span>
            <span className="mock-chip">Duration: {durationLabel}</span>
          </div>
        </div>

        <div className="mock-briefing-grid">
          <div className="mock-briefing-copy">
            <p className="mock-block-title">Guidelines</p>
            <ul className="mock-guideline-list">
              <li>Find a quiet, well-lit space with stable internet.</li>
              <li>Use earphones or a clear speaker setup for better audio quality.</li>
              <li>Keep your face visible and sit upright throughout the session.</li>
              <li>Answer naturally in your own words using resume-backed examples.</li>
              <li>Do not switch tabs, copy content, or use outside help once it starts.</li>
              <li>Your proctoring signals may be reviewed alongside the interview score.</li>
            </ul>
          </div>

          <div className="mock-settings-shell">
            <p className="mock-block-title">Session Setup</p>
            <div className="mock-settings-grid">
              <label className="mock-field mock-field--wide">
                <span className="mock-field-label">Resume PDF</span>
                <div className="mock-upload-box">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleResumeChange}
                    className="mock-upload-input"
                  />
                  <div className="mock-upload-copy">
                    <FileText size={16} />
                    <span>
                      {resumeFile
                        ? resumeFile.name
                        : "Upload your resume to personalize the interview"}
                    </span>
                  </div>
                </div>
              </label>

              {[
                {
                  label: "English Level",
                  value: englishLevel,
                  onChange: setEnglishLevel,
                  options: ENGLISH_OPTIONS,
                },
                {
                  label: "Difficulty",
                  value: difficulty,
                  onChange: setDifficulty,
                  options: DIFFICULTY_OPTIONS,
                },
              ].map((field) => (
                <label key={field.label} className="mock-field">
                  <span className="mock-field-label">{field.label}</span>
                  <select
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    className="mock-select"
                  >
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {formatLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              <label className="mock-field">
                <span className="mock-field-label">Questions</span>
                <select
                  value={totalQuestions}
                  onChange={(event) => setTotalQuestions(Number(event.target.value))}
                  className="mock-select"
                >
                  {QUESTION_COUNT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="mock-surface mock-consent-card">
        <label className="mock-consent-row">
          <input
            type="checkbox"
            checked={rulesAccepted}
            onChange={(event) => setRulesAccepted(event.target.checked)}
            className="mock-checkbox"
          />
          <span>
            I understand that cheating, using external devices, switching tabs,
            or taking off-screen help can lead to disqualification.
          </span>
        </label>

        <div className="mock-consent-actions">
          <div className="mock-consent-note">
            By continuing, you agree that this interview session can be
            monitored for fairness and recording quality.
          </div>

          <button
            type="button"
            onClick={goToSystemCheck}
            className="btn-primary mock-action-btn"
          >
            I&apos;m ready to continue
            <ChevronRight size={16} />
          </button>
        </div>
      </section>
    </motion.div>
  );

  const renderSystemStage = () => (
    <motion.div
      key="system"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="mock-stage-stack"
    >
      <FlowStepper activeStep="system" />

      <section className="mock-surface mock-hero-card">
        <div className="mock-hero-copy">
          <p className="mock-greeting">Hi there!</p>
          <h1 className="mock-hero-title">Welcome to your AI Interview</h1>
          <p className="mock-hero-subtitle">
            Before starting, we&apos;ll run a short system check to make sure
            the interview stays smooth, secure, and fair.
          </p>
        </div>
        <div className="mock-hero-step">Stage 2 of 5</div>
      </section>

      <section className="mock-system-grid">
        <section className="mock-surface mock-system-card">
          <div className="mock-system-head">
            <div>
              <p className="mock-section-kicker">Security Check</p>
              <h2 className="mock-section-title">Device and audio readiness</h2>
            </div>
            <span className="mock-chip">
              {readyToStart ? "Ready to launch" : "Setup in progress"}
            </span>
          </div>

          <div className="mock-check-stack">
            <DeviceRow
              icon={<Wifi size={18} />}
              title={networkState.title}
              description={`${networkState.detail}${networkState.meta ? ` ${networkState.meta}` : ""}`}
              status={networkState.status}
              action={(
                <button type="button" onClick={runNetworkCheck} className="btn-ghost">
                  Retest
                </button>
              )}
            />

            <DeviceRow
              icon={<Video size={18} className="text-cyan-200" />}
              title="Camera & microphone access"
              description="Both permissions are required for live preview, audio response, and cheating detection."
              status={
                deviceState.cameraReady && deviceState.microphoneReady
                  ? "ready"
                  : deviceState.permissionsRequested
                    ? "warning"
                    : "error"
              }
              action={(
                <button type="button" onClick={requestPermissions} className="btn-secondary">
                  Enable Access
                </button>
              )}
            />

            <DeviceRow
              icon={<Mic size={18} className="text-emerald-200" />}
              title="Testing microphone"
              description={
                micCheckTranscript
                  ? `Captured: ${micCheckTranscript}`
                  : `Please say: "${MIC_CHECK_PHRASE}"`
              }
              status={
                micPhraseVerified
                  ? "ready"
                  : micCheckListening
                    ? "checking"
                    : deviceState.microphoneReady
                      ? "warning"
                      : "error"
              }
              action={(
                <button type="button" onClick={beginMicCheck} className="btn-primary">
                  {micCheckListening ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Listening...
                    </>
                  ) : (
                    "Speak Now"
                  )}
                </button>
              )}
            />

            <DeviceRow
              icon={<Volume2 size={18} className="text-orange-200" />}
              title="Speaker test"
              description="Play the sample voice and confirm that you can hear the interviewer clearly."
              status={speakerConfirmed ? "ready" : "warning"}
              action={(
                <div className="mock-check-actions-row">
                  <button type="button" onClick={playSpeakerSample} className="btn-ghost">
                    Play Sample
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpeakerConfirmed(true)}
                    className="btn-secondary"
                  >
                    I Heard It
                  </button>
                </div>
              )}
            />

            <DeviceRow
              icon={<ShieldCheck size={18} className="text-sky-200" />}
              title="Anti-cheat monitoring"
              description="Tab switching, copy-paste attempts, dark frames, movement, and face visibility are monitored."
              status={deviceState.browserReady ? "ready" : "error"}
              action={(
                <span className="badge">
                  {deviceState.speechRecognitionReady
                    ? "Voice input ready"
                    : "Typing fallback active"}
                </span>
              )}
            />
          </div>
        </section>

        <section className="mock-surface mock-preview-card">
          <div className="mock-preview-head">
            <div>
              <p className="mock-section-kicker">Camera Preview</p>
              <h2 className="mock-section-title">Check your frame</h2>
            </div>
            <span className="mock-chip">
              {mediaStream ? "Camera live" : "Waiting for permission"}
            </span>
          </div>

          <div className="mock-preview-frame">
            {mediaStream ? (
              <video
                ref={previewVideoRef}
                autoPlay
                muted
                playsInline
                className="mock-preview-video"
              />
            ) : (
              <div className="mock-preview-placeholder">
                <Video size={22} />
                <p>Waiting for camera permission...</p>
              </div>
            )}
            <span className="mock-preview-name">You</span>
          </div>

          <div className="mock-preview-metrics">
            <span className="mock-chip">{resumeFile ? "Resume loaded" : "Resume pending"}</span>
            <span className="mock-chip">
              {deviceState.microphoneReady ? `Mic ${(micLevel * 100).toFixed(0)}%` : "Mic pending"}
            </span>
            <span className="mock-chip">
              {speakerConfirmed ? "Speaker checked" : "Speaker pending"}
            </span>
          </div>
        </section>
      </section>

      <div className="mock-stage-actions">
        <button
          type="button"
          onClick={() => setSetupStage("briefing")}
          className="btn-ghost mock-action-btn"
        >
          <ChevronLeft size={16} />
          Back
        </button>

        <button
          type="button"
          onClick={openSecurityGate}
          className="btn-primary mock-action-btn"
        >
          Ready to continue
          <ChevronRight size={16} />
        </button>
      </div>
    </motion.div>
  );

  const renderResultsStage = () => {
    const answeredQuestions = Number(interviewResult?.answeredQuestions || 0);
    const resultTotalQuestions = Number(interviewResult?.totalQuestions || totalQuestions);
    const resultRole = interviewResult?.role || session?.role || "full stack";
    const resultDifficulty = interviewResult?.difficulty || difficulty;
    const resultEnglishLevel = interviewResult?.englishLevel || englishLevel;
    const resultDuration = Number(interviewResult?.elapsedSeconds || 0);

    return (
      <motion.div
        key="results"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        className="mock-stage-stack"
      >
        <FlowStepper activeStep="results" />

        <section className="mock-surface mock-results-hero">
          <div className="mock-results-hero__copy">
            <p className="mock-section-kicker">Interview Debrief</p>
            <h1 className="mock-hero-title">Results, suggestions, and next steps</h1>
            <p className="mock-hero-subtitle">
              {interviewResult?.summary ||
                "Your interview report is ready. Review the highlights below and use them to sharpen the next attempt."}
            </p>

            <div className="mock-chip-row">
              <span className="mock-chip">{formatLabel(resultRole)}</span>
              <span className="mock-chip">{formatLabel(resultEnglishLevel)} English</span>
              <span className="mock-chip">{formatLabel(resultDifficulty)}</span>
              <span className="mock-chip">
                Answered {answeredQuestions}/{resultTotalQuestions}
              </span>
              <span className="mock-chip">{formatDuration(resultDuration)}</span>
            </div>
          </div>

          <div className="mock-results-hero__score">
            <span className="mock-results-hero__score-label">Overall</span>
            <strong>
              {Number.isFinite(interviewResult?.overallScore)
                ? `${Math.round(interviewResult.overallScore)}%`
                : "Pending"}
            </strong>
            <span>
              {interviewResult?.fallbackUsed ? "Fallback report" : "AI report ready"}
            </span>
          </div>
        </section>

        {interviewResult?.message ? (
          <section className="mock-surface mock-result-banner">
            <BarChart3 size={18} />
            <p>{interviewResult.message}</p>
          </section>
        ) : null}

        <section className="mock-results-grid">
          <article className="mock-surface mock-results-summary-card">
            <div className="mock-panel-head">
              <div>
                <p className="mock-section-kicker">Performance Snapshot</p>
                <h2 className="mock-panel-title">Score breakdown</h2>
              </div>
              <span className="mock-card-tag">
                <BarChart3 size={14} />
                Performance
              </span>
            </div>

            <div className="mock-results-score-grid">
              <ScoreCard label="Overall" value={interviewResult?.overallScore} tone="primary" />
              <ScoreCard
                label="Communication"
                value={interviewResult?.communicationScore}
                tone="accent"
              />
              <ScoreCard
                label="Technical Thinking"
                value={interviewResult?.technicalScore}
                tone="neutral"
              />
              <ScoreCard
                label="Confidence"
                value={interviewResult?.confidenceScore}
                tone="warm"
              />
            </div>

            {interviewResult?.integrityNote ? (
              <div className="mock-security-warning mock-security-warning--result">
                {interviewResult.integrityNote}
              </div>
            ) : (
              <div className="mock-summary-copy">
                No major integrity warning was raised in the final report. Keep the same focus and framing in your next practice run.
              </div>
            )}

            {interviewResult?.hiringSignal ? (
              <div className="mock-summary-copy">
                <strong>Hiring signal:</strong> {interviewResult.hiringSignal}
              </div>
            ) : null}

            {interviewResult?.communicationSummary ? (
              <div className="mock-summary-copy">
                <strong>Communication:</strong> {interviewResult.communicationSummary}
              </div>
            ) : null}

            {interviewResult?.technicalSummary ? (
              <div className="mock-summary-copy">
                <strong>Technical thinking:</strong> {interviewResult.technicalSummary}
              </div>
            ) : null}

            {interviewResult?.confidenceSummary ? (
              <div className="mock-summary-copy">
                <strong>Confidence:</strong> {interviewResult.confidenceSummary}
              </div>
            ) : null}
          </article>

          <article className="mock-surface mock-results-list-card">
            <div className="mock-result-list-grid">
              <ResultList
                title="What went well"
                items={
                  interviewResult?.strengths?.length
                    ? interviewResult.strengths
                    : ["You completed the interview flow and received a report."]
                }
                tone="positive"
              />
              <ResultList
                title="Improve next"
                items={
                  interviewResult?.improvements?.length
                    ? interviewResult.improvements
                    : ["Use more detailed examples and clearer ownership language next time."]
                }
                tone="negative"
              />
            </div>

            {(interviewResult?.nextSteps || []).length ? (
              <div className="mock-result-list-grid">
                <ResultList
                  title="Next practice plan"
                  items={interviewResult.nextSteps}
                  tone="negative"
                />
              </div>
            ) : null}
          </article>
        </section>

        <section className="mock-surface mock-results-actions">
          <div>
            <p className="mock-block-title">Ready for another mock interview?</p>
            <p className="mock-summary-copy">
              You can return to the system check, re-enable camera and microphone access,
              and launch another live interview with the same resume setup.
            </p>
          </div>

          <div className="mock-modal-actions">
            <button
              type="button"
              onClick={() => resetInterviewFlow("")}
              className="btn-ghost mock-action-btn"
            >
              Back to briefing
            </button>
            <button
              type="button"
              onClick={() => {
                setInterviewResult(null);
                setSetupStage("system");
                setSetupError("");
                setNotice("Run the checks again before starting another interview.");
              }}
              className="btn-primary mock-action-btn"
            >
              <RefreshCcw size={16} />
              Practice again
            </button>
          </div>
        </section>
      </motion.div>
    );
  };

  if (session) {
    return (
      <InterviewCore
        initialSession={session}
        mediaStream={mediaStream}
        candidateLabel="You"
        onFinish={(resultPayload) =>
          void handleInterviewComplete(
            resultPayload ||
              createFallbackInterviewResult({
                answeredQuestions: 0,
                totalQuestions,
                role: session.role,
                difficulty,
                englishLevel,
                message: "Interview closed. Camera and microphone access were released.",
              }),
          )
        }
      />
    );
  }

  return (
    <div className="page-shell mock-interview-shell">
      <div className="mock-interview-backdrop" aria-hidden="true">
        <div className="mock-interview-orb mock-interview-orb--a" />
        <div className="mock-interview-orb mock-interview-orb--b" />
        <ParticleMesh className="mock-interview-mesh" />
      </div>

      <div className="page-inner mock-interview-page">
        <AnimatePresence mode="wait">
          {interviewResult
            ? renderResultsStage()
            : setupStage === "briefing"
              ? renderBriefingStage()
              : renderSystemStage()}
        </AnimatePresence>

        {!interviewResult && setupError ? (
          <p className="mock-feedback-message is-error">{setupError}</p>
        ) : null}
        {!interviewResult && notice ? (
          <p className="mock-feedback-message is-note">{notice}</p>
        ) : null}
      </div>

      <AnimatePresence>
        {securityModalOpen ? (
          <motion.div
            className="mock-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="mock-surface mock-security-modal"
            >
              <FlowStepper activeStep="security" compact />
              <div className="mock-security-icon">
                <ShieldAlert size={22} />
              </div>
              <p className="mock-section-kicker">Security Notice</p>
              <h2 className="mock-security-title">Cheating strictly prohibited</h2>
              <p className="mock-security-copy">
                Your interview is being recorded. Advanced checks are active to
                detect tab switching, extra devices, camera removal, multiple
                faces, and other forms of external assistance.
              </p>

              <div className="mock-security-list">
                {[
                  "Do not use AI tools like ChatGPT or other answer assistants.",
                  "Do not use additional devices such as phones or tablets.",
                  "Do not switch tabs or open other apps during the interview.",
                  "Do not turn your camera off or move out of the frame.",
                ].map((item) => (
                  <div key={item} className="mock-security-list__item">
                    <XCircle size={16} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mock-security-warning">
                Cheating, even reading from another screen, can affect your
                interview report and may lead to disqualification from the
                assessment flow.
              </div>

              <div className="mock-modal-actions">
                <button
                  type="button"
                  onClick={() => setSecurityModalOpen(false)}
                  className="btn-ghost mock-action-btn"
                >
                  Go back
                </button>
                <button
                  type="button"
                  onClick={handleStartInterview}
                  className="btn-primary mock-action-btn"
                >
                  <ShieldCheck size={16} />
                  I understand, begin interview
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {preparingInterview ? (
          <motion.div
            className="mock-overlay mock-overlay--loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="mock-surface mock-loader-card"
            >
              <Loader2 size={22} className="animate-spin" />
              <div>
                <p className="mock-loader-title">Stage 4 of 5: interviewer is joining...</p>
                <p className="mock-loader-copy">
                  Preparing your resume-aware interview, validating the session
                  handoff, and launching the live interview room.
                </p>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default MockInterview;
