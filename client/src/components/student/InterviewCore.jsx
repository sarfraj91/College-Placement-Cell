import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Clock3,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Send,
  ShieldAlert,
  Target,
  UserRound,
  Video,
  Volume2,
} from "lucide-react";

import {
  continueMockInterview,
  finishMockInterview,
} from "../../services/interviewQaApi.jsx";
import { cancelSpeech, speakText } from "../../utils/speechPlayback.js";
import ParticleMesh from "../ui/ParticleMesh.jsx";

const formatDuration = (seconds = 0) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

const formatLabel = (value = "") =>
  String(value || "")
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const createSignalCounts = () => ({
  motionAlerts: 0,
  noFaceAlerts: 0,
  multiFaceAlerts: 0,
  noVoiceAlerts: 0,
  focusAlerts: 0,
  blockedAlerts: 0,
});

export default function InterviewCore({
  initialSession,
  mediaStream,
  candidateLabel = "You",
  onFinish,
}) {
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const cooldownRef = useRef({});
  const timerRef = useRef(null);
  const monitorRef = useRef(null);
  const audioContextRef = useRef(null);
  const liveAnalyserRef = useRef(null);
  const liveSourceRef = useRef(null);
  const audioMonitorRef = useRef(null);
  const silentStreakRef = useRef(0);
  const speechWarningShownRef = useRef(false);

  const [currentQuestion, setCurrentQuestion] = useState(initialSession.question || "");
  const [interviewerReply, setInterviewerReply] = useState(initialSession.opening || "");
  const [answerSignal, setAnswerSignal] = useState("");
  const [coachingTip, setCoachingTip] = useState(
    "Use a simple flow: context, action, result, then one tradeoff or learning.",
  );
  const [history, setHistory] = useState([]);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [questionIndex, setQuestionIndex] = useState(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState(initialSession.warning || "");
  const [flags, setFlags] = useState([]);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [signalCounts, setSignalCounts] = useState(createSignalCounts);
  const [cameraState, setCameraState] = useState({
    brightness: 0,
    motion: 0,
    faceCount: null,
    mode:
      typeof window !== "undefined" && "FaceDetector" in window ? "face" : "basic",
  });

  const recognitionSupported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const totalQuestionCount = Math.max(Number(initialSession.totalQuestions) || 1, 1);
  const faceAlertCount = signalCounts.noFaceAlerts + signalCounts.multiFaceAlerts;
  const focusAlertCount = signalCounts.focusAlerts + signalCounts.blockedAlerts;
  const recentFlags = useMemo(() => flags.slice(0, 3), [flags]);
  const answerWordCount = useMemo(() => {
    const trimmedAnswer = draftAnswer.trim();
    return trimmedAnswer ? trimmedAnswer.split(/\s+/).length : 0;
  }, [draftAnswer]);
  const trimmedDraftAnswer = draftAnswer.trim();
  const canSubmitAnswer = trimmedDraftAnswer.length >= 5 && !isSubmitting && !isFinishing;
  const questionProgressPercent = Math.max(
    8,
    Math.min(100, Math.round((questionIndex / totalQuestionCount) * 100)),
  );
  const answerGuidance =
    answerWordCount >= 80
      ? "Strong detail. Do one quick clarity pass and finish with the result or impact."
      : answerWordCount >= 30
        ? "Good start. Add one concrete metric, tradeoff, or outcome before you submit."
        : "Use a simple flow: situation, action, and result. One concrete example is enough.";
  const voiceMeterPercent = useMemo(
    () => Math.max(4, Math.min(100, Math.round(voiceLevel * 100))),
    [voiceLevel],
  );
  const detectedFaceCount = cameraState.faceCount ?? 1;
  const movementMetric = cameraState.motion || signalCounts.motionAlerts;
  const securityWarning =
    signalCounts.motionAlerts > 10
      ? "Movement alerts are getting high. Stay steady and keep the camera centered."
      : faceAlertCount >= 3
        ? "Face visibility alerts are increasing. Keep only one face visible in the frame."
        : signalCounts.noVoiceAlerts >= 3
          ? "Very low voice activity is being detected. Speak clearly into the microphone."
          : "";
  const interviewerStatus = isFinishing
    ? "Wrapping up"
    : isSubmitting
      ? "Reviewing your answer"
      : currentQuestion
        ? "Awaiting your response"
        : "Preparing the next question";
  const candidateMode = recognitionSupported
    ? isListening
      ? "Voice capture"
      : "Voice ready"
    : "Typing mode";
  const candidateStatus = isFinishing
    ? "Ending"
    : isSubmitting
      ? "Submitting"
      : isListening
        ? "Recording"
        : answerWordCount > 0
          ? "Drafting"
          : "Ready";
  const activeBanner = pageError
    ? { tone: "error", text: pageError }
    : securityWarning
      ? { tone: "warning", text: securityWarning }
      : notice
        ? { tone: "note", text: notice }
        : null;
  const latestSignalMessage =
    recentFlags[0]?.message || "No live alerts. Stay focused, centered, and answer naturally.";
  const liveMonitorCards = [
    {
      icon: <UserRound size={15} />,
      label: "Face Detection",
      value: `${Math.max(detectedFaceCount, 1)}`,
      hint:
        faceAlertCount > 0
          ? "Re-center the frame so only one face stays visible."
          : "Single face is visible and stable.",
      tone: faceAlertCount > 0 ? "warning" : "positive",
    },
    {
      icon: <Activity size={15} />,
      label: "Movement",
      value: `${movementMetric}`,
      hint:
        signalCounts.motionAlerts > 0
          ? "Movement alerts were raised. Sit a little steadier."
          : "Body movement looks controlled.",
      tone: signalCounts.motionAlerts > 0 ? "warning" : "neutral",
    },
    {
      icon: <Clock3 size={15} />,
      label: "Question Progress",
      value: `${questionIndex}/${totalQuestionCount}`,
      hint: "Track how far you are in this mock interview.",
      tone: "accent",
    },
    {
      icon: <ShieldAlert size={15} />,
      label: "Security Alerts",
      value: `${flags.length}`,
      hint:
        flags.length > 0
          ? "Review the latest notice below."
          : "No active integrity concerns.",
      tone: flags.length > 0 ? "warning" : "positive",
    },
  ];

  const pushFlag = (message, key, wait = 18000, countKey = "") => {
    const now = Date.now();
    if (cooldownRef.current[key] && now - cooldownRef.current[key] < wait) return;
    cooldownRef.current[key] = now;

    if (countKey) {
      setSignalCounts((previous) => ({
        ...previous,
        [countKey]: previous[countKey] + 1,
      }));
    }

    setFlags((previous) => [
      { id: `${key}-${now}`, message, time: new Date(now).toLocaleTimeString() },
      ...previous,
    ].slice(0, 12));
  };

  const speak = async (text) => {
    const spoken = await speakText(text, { lang: "en-IN", rate: 1 });
    if (!spoken && !speechWarningShownRef.current) {
      speechWarningShownRef.current = true;
      setNotice(
        "Interviewer voice playback is unavailable in this browser, but the interview will continue normally.",
      );
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setIsListening(false);
  };

  const startListening = () => {
    if (!recognitionSupported) {
      setPageError("Voice typing is not available here. Type your answer instead.");
      return;
    }

    stopListening();
    setPageError("");

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.onresult = (event) => {
      const transcript = [];
      for (let index = 0; index < event.results.length; index += 1) {
        transcript.push(event.results[index][0].transcript);
      }
      setDraftAnswer(transcript.join(" ").trim());
    };
    recognition.onerror = () => {
      setPageError("Voice typing stopped. You can continue by typing.");
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  const buildFallbackResult = (
    nextHistory = history,
    fallbackMessage = "Interview ended. Camera and microphone access were released.",
    serviceUnavailable = false,
  ) => {
    const answeredQuestions = nextHistory.length;
    const improvements = [
      "Use one specific project example in each answer so your impact is easier to understand.",
      "Explain why you chose an approach, not only what you built.",
      "Keep your answers structured with context, action, and result.",
    ];

    if (signalCounts.noVoiceAlerts > 0) {
      improvements.unshift(
        "Speak a little louder and keep a steady pace so the microphone captures your response cleanly.",
      );
    }

    if (focusAlertCount > 0) {
      improvements.unshift(
        "Stay on the interview tab and avoid shortcut or context-switching activity during the interview.",
      );
    }

    const strengths = answeredQuestions
      ? [
          answeredQuestions >= initialSession.totalQuestions
            ? "You stayed with the interview through the planned question set."
            : "You kept the conversation moving by submitting answers inside the live interview flow.",
          "You kept the camera and microphone active throughout the captured session.",
        ]
      : ["You completed the setup flow and reached the live interview stage."];

    return {
      summary: answeredQuestions
        ? serviceUnavailable
          ? "The interview ended safely, but the detailed AI report was unavailable. Use these improvement pointers to prepare for your next attempt."
          : "The interview ended before a complete report could be generated, so this summary highlights the clearest next steps."
        : "The interview ended before enough answers were captured to generate a detailed report. Complete at least one full answer next time to unlock richer feedback.",
      strengths,
      improvements: improvements.slice(0, 3),
      overallScore: null,
      communicationScore: null,
      technicalScore: null,
      confidenceScore: null,
      integrityNote: flags.length
        ? `Interview integrity signals were raised ${flags.length} time(s). Review focus changes, camera framing, and movement before your next run.`
        : "",
      hiringSignal:
        answeredQuestions > 0
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
      message: fallbackMessage,
      answeredQuestions,
      totalQuestions: initialSession.totalQuestions,
      elapsedSeconds,
      role: initialSession.role,
      difficulty: initialSession.difficulty,
      englishLevel: initialSession.englishLevel,
      history: nextHistory,
      proctorFlags: flags.map((item) => item.message),
    };
  };

  const exitInterview = async (
    nextHistory = history,
    fallbackMessage = "Interview ended. Camera and microphone access were released.",
  ) => {
    stopListening();
    cancelSpeech();
    setIsFinishing(true);

    let resultPayload = buildFallbackResult(nextHistory, fallbackMessage);

    try {
      if (nextHistory.length) {
        const data = await finishMockInterview({
          history: nextHistory,
          role: initialSession.role,
          difficulty: initialSession.difficulty,
          englishLevel: initialSession.englishLevel,
          totalQuestions: initialSession.totalQuestions,
          resumeSummary: initialSession.profile?.resumeSummary || "",
          resumeSkills: initialSession.profile?.resumeSkills || [],
          skills: initialSession.profile?.skills || [],
          projects: initialSession.profile?.projects || "",
          experience: initialSession.profile?.experience || "",
          proctorFlags: flags.map((item) => item.message),
        });

        resultPayload = {
          summary: data?.summary || resultPayload.summary,
          strengths: data?.strengths?.length ? data.strengths : resultPayload.strengths,
          improvements: data?.improvements?.length
            ? data.improvements
            : resultPayload.improvements,
          overallScore: Number.isFinite(Number(data?.overallScore))
            ? Number(data.overallScore)
            : null,
          communicationScore: Number.isFinite(Number(data?.communicationScore))
            ? Number(data.communicationScore)
            : null,
          technicalScore: Number.isFinite(Number(data?.technicalScore))
            ? Number(data.technicalScore)
            : null,
          confidenceScore: Number.isFinite(Number(data?.confidenceScore))
            ? Number(data.confidenceScore)
            : null,
          integrityNote: data?.integrityNote || resultPayload.integrityNote,
          hiringSignal: data?.hiringSignal || resultPayload.hiringSignal,
          communicationSummary:
            data?.communicationSummary || resultPayload.communicationSummary,
          technicalSummary:
            data?.technicalSummary || resultPayload.technicalSummary,
          confidenceSummary:
            data?.confidenceSummary || resultPayload.confidenceSummary,
          nextSteps:
            Array.isArray(data?.nextSteps) && data.nextSteps.length
              ? data.nextSteps
              : resultPayload.nextSteps,
          fallbackUsed: Boolean(data?.warning),
          message: data?.warning ? `${fallbackMessage} ${data.warning}` : fallbackMessage,
          answeredQuestions: nextHistory.length,
          totalQuestions: initialSession.totalQuestions,
          elapsedSeconds,
          role: initialSession.role,
          difficulty: initialSession.difficulty,
          englishLevel: initialSession.englishLevel,
          history: nextHistory,
          proctorFlags: flags.map((item) => item.message),
        };
      }
    } catch {
      resultPayload = buildFallbackResult(nextHistory, fallbackMessage, true);
    } finally {
      setIsFinishing(false);
      onFinish(resultPayload);
    }
  };

  const submitAnswer = async () => {
    const userAnswer = draftAnswer.trim();
    if (!currentQuestion || userAnswer.length < 5) {
      setPageError("Please answer the current question before moving on.");
      return;
    }

    try {
      setIsSubmitting(true);
      setPageError("");
      setNotice("");
      stopListening();

      const data = await continueMockInterview({
        currentQuestion,
        userAnswer,
        history,
        role: initialSession.role,
        difficulty: initialSession.difficulty,
        englishLevel: initialSession.englishLevel,
        totalQuestions: initialSession.totalQuestions,
        questionIndex,
        resumeSummary: initialSession.profile?.resumeSummary || "",
        resumeSkills: initialSession.profile?.resumeSkills || [],
        skills: initialSession.profile?.skills || [],
        projects: initialSession.profile?.projects || "",
        experience: initialSession.profile?.experience || "",
      });

      const nextHistory = [
        ...history,
        {
          question: currentQuestion,
          answer: userAnswer,
          interviewerReply: data?.interviewerReply || "",
        },
      ];

      setHistory(nextHistory);
      setDraftAnswer("");
      setInterviewerReply(data?.interviewerReply || "");
      setAnswerSignal(data?.answerSignal || "");
      setCoachingTip(
        data?.coachingTip ||
          "Use one concrete example, one clear decision, and one outcome in your next answer.",
      );
      if (data?.warning) setNotice(data.warning);

      if (data?.shouldEnd || !data?.question) {
        await exitInterview(
          nextHistory,
          data?.closingRemark || "Interview finished. Camera and microphone access were released.",
        );
        return;
      }

      setCurrentQuestion(data.question);
      setQuestionIndex((previous) => previous + 1);
      void speak(`${data?.interviewerReply || ""} ${data?.question || ""}`);
    } catch (error) {
      setPageError(error?.response?.data?.message || "Unable to continue the interview.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!videoRef.current || !mediaStream) return;
    videoRef.current.srcObject = mediaStream;
    videoRef.current.play().catch(() => {});
  }, [mediaStream]);

  useEffect(() => {
    void speak(`${initialSession.opening || ""} ${initialSession.question || ""}`);
    return () => {
      cancelSpeech();
      stopListening();
    };
  }, [initialSession.opening, initialSession.question]);

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((previous) => previous + 1);
    }, 1000);

    return () => window.clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    const onHide = () =>
      document.hidden &&
      pushFlag("Interview tab was hidden.", "tab-hide", 7000, "focusAlerts");
    const onBlur = () =>
      pushFlag("Window focus left the interview screen.", "blur", 7000, "focusAlerts");
    const onBlocked = (event) => {
      event.preventDefault();
      pushFlag(
        `${event.type} action was blocked during the interview.`,
        event.type,
        7000,
        "blockedAlerts",
      );
    };
    const onKey = (event) => {
      const loweredKey = String(event.key || "").toLowerCase();
      if (
        event.key === "F12" ||
        event.key === "F5" ||
        (event.altKey && loweredKey === "arrowleft") ||
        ((event.ctrlKey || event.metaKey) &&
          ["c", "v", "x", "t", "w", "n", "i", "j", "r"].includes(loweredKey))
      ) {
        event.preventDefault();
        pushFlag(
          `Shortcut ${event.key} was attempted during the interview.`,
          `shortcut-${loweredKey || "f12"}`,
          7000,
          "blockedAlerts",
        );
      }
    };

    document.addEventListener("visibilitychange", onHide);
    document.addEventListener("copy", onBlocked);
    document.addEventListener("paste", onBlocked);
    document.addEventListener("cut", onBlocked);
    document.addEventListener("contextmenu", onBlocked);
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("visibilitychange", onHide);
      document.removeEventListener("copy", onBlocked);
      document.removeEventListener("paste", onBlocked);
      document.removeEventListener("cut", onBlocked);
      document.removeEventListener("contextmenu", onBlocked);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const currentUrl = window.location.href;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onPopState = () => {
      window.history.pushState({ mockInterviewLock: true }, "", currentUrl);
      setPageError("Use End Interview to leave the live interview.");
      pushFlag(
        "Browser back navigation was blocked during the interview.",
        "history-back",
        7000,
        "focusAlerts",
      );
    };

    window.history.pushState({ mockInterviewLock: true }, "", currentUrl);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (!mediaStream) return undefined;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return undefined;

    const detector =
      "FaceDetector" in window ? new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 }) : null;

    let cancelled = false;
    let previousFrame = null;

    const inspect = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) {
        monitorRef.current = window.setTimeout(inspect, 1500);
        return;
      }

      canvas.width = 320;
      canvas.height = 180;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let brightness = 0;
      let motion = 0;
      const values = [];

      for (let index = 0; index < frame.length; index += 20) {
        const value = (frame[index] + frame[index + 1] + frame[index + 2]) / 3;
        brightness += value;
        values.push(value);
        if (previousFrame) motion += Math.abs(value - previousFrame[values.length - 1]);
      }

      brightness = Math.round(brightness / Math.max(values.length, 1));
      motion = previousFrame ? Math.round(motion / Math.max(values.length, 1)) : 0;
      previousFrame = values;
      setCameraState((previous) => ({ ...previous, brightness, motion }));

      if (brightness < 22) {
        pushFlag("Camera feed looks too dark or obstructed.", "dark-camera", 12000);
      }
      if (motion > 70) {
        pushFlag(
          "Excessive movement was detected in frame.",
          "camera-motion",
          5000,
          "motionAlerts",
        );
      }

      if (detector) {
        try {
          const faces = await detector.detect(video);
          setCameraState((previous) => ({ ...previous, faceCount: faces.length }));
          if (faces.length === 0) {
            pushFlag("Face not detected in camera frame.", "no-face", 7000, "noFaceAlerts");
          }
          if (faces.length > 1) {
            pushFlag(
              "Multiple faces detected in camera frame.",
              "multi-face",
              7000,
              "multiFaceAlerts",
            );
          }
        } catch {
          setCameraState((previous) => ({ ...previous, mode: "basic" }));
        }
      }

      monitorRef.current = window.setTimeout(inspect, 1500);
    };

    void inspect();

    return () => {
      cancelled = true;
      if (monitorRef.current) clearTimeout(monitorRef.current);
    };
  }, [mediaStream]);

  useEffect(() => {
    if (!mediaStream) return undefined;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor || !mediaStream.getAudioTracks().length) return undefined;

    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(mediaStream);
    const samples = new Uint8Array(analyser.frequencyBinCount);

    analyser.fftSize = 256;
    source.connect(analyser);

    audioContextRef.current = audioContext;
    liveAnalyserRef.current = analyser;
    liveSourceRef.current = source;
    silentStreakRef.current = 0;

    audioContext.resume().catch(() => {});

    audioMonitorRef.current = window.setInterval(() => {
      liveAnalyserRef.current?.getByteFrequencyData(samples);
      const average =
        samples.reduce((sum, item) => sum + item, 0) / Math.max(samples.length, 1);
      const normalizedLevel = average / 255;

      setVoiceLevel(normalizedLevel);

      if (normalizedLevel < 0.018) {
        silentStreakRef.current += 1;
        if (silentStreakRef.current >= 8) {
          pushFlag(
            "Very low voice activity was detected for a prolonged period.",
            "no-voice",
            12000,
            "noVoiceAlerts",
          );
          silentStreakRef.current = 0;
        }
      } else {
        silentStreakRef.current = 0;
      }
    }, 1500);

    return () => {
      if (audioMonitorRef.current) {
        clearInterval(audioMonitorRef.current);
      }
      silentStreakRef.current = 0;
      liveSourceRef.current?.disconnect?.();
      liveAnalyserRef.current?.disconnect?.();
      audioContextRef.current?.close?.().catch(() => {});
      liveSourceRef.current = null;
      liveAnalyserRef.current = null;
      audioContextRef.current = null;
      setVoiceLevel(0);
    };
  }, [mediaStream]);

  return (
    <div className="page-shell mock-interview-shell mock-live-shell">
      <div className="mock-interview-backdrop" aria-hidden="true">
        <div className="mock-interview-orb mock-interview-orb--a" />
        <div className="mock-interview-orb mock-interview-orb--b" />
        <ParticleMesh className="mock-interview-mesh" />
      </div>

      <div className="page-inner mock-interview-page mock-live-room">
        <div className="mock-live-room__topbar">
          <div className="mock-live-room__brand">
            <div className="mock-live-room__brand-mark">
              <Activity size={13} />
            </div>
            <div className="mock-live-room__brand-copy">
              <strong>Mock Interview Room</strong>
              <span>live practice environment</span>
            </div>
          </div>

          <div className="mock-live-room__topbar-group">
            <span className="mock-chip">Live interview</span>
            <span className="mock-chip">Q {questionIndex}/{totalQuestionCount}</span>
            <span className="mock-chip">{formatLabel(initialSession.difficulty)}</span>
            <span className="mock-chip">{formatLabel(initialSession.englishLevel)} English</span>
            <span className="mock-chip">
              <Clock3 size={14} />
              {formatDuration(elapsedSeconds)}
            </span>
            <span className="mock-chip">
              {recognitionSupported ? candidateMode : "Typing fallback"}
            </span>
            <span className="mock-chip">Focus monitored</span>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {activeBanner ? (
            <motion.p
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className={`mock-feedback-message is-${activeBanner.tone} mock-live-room__banner`}
            >
              {activeBanner.text}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <section className="mock-live-room__grid">
          <motion.article
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mock-surface mock-live-room__stage"
          >
            <div className="mock-live-room__section-head">
              <div className="mock-live-room__section-title-wrap">
                <div className="mock-live-room__section-icon">
                  <UserRound size={18} />
                </div>
                <div>
                  <p className="mock-section-kicker">Interviewer Stage</p>
                  <h1 className="mock-live-room__section-title">AI Interviewer</h1>
                  {/* <p className="mock-live-room__section-copy">
                    Listen to the prompt, understand the follow-up, then craft a clear and
                    structured response.
                  </p> */}
                </div>
              </div>
              <span className="mock-live-room__role-badge is-host">Host</span>
            </div>

            <div className="mock-live-room__stage-canvas">
              <div className="mock-live-room__host-console" aria-hidden="true">
                <div className="mock-live-room__host-orb">
                  <span className="mock-live-room__host-ring is-outer" />
                  <span className="mock-live-room__host-ring is-inner" />
                  <div className="mock-live-room__host-core">IRA</div>
                </div>

                <div className="mock-live-room__host-copy">
                  <span className="mock-live-room__host-label">AI Host</span>
                  <strong>Resume-aware interviewer</strong>
                  <p>Prompting questions in a guided, role-focused sequence.</p>
                </div>

                <div className="mock-live-room__host-wave">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              <div className="mock-live-room__prompt-stack">
                {/* <div className="mock-live-room__reply-card">
                  <span className="mock-live-room__eyebrow">Interviewer cue</span>
                  <p>{interviewerReply || "The interviewer response will appear here."}</p>
                </div> */}

                {/* {answerSignal || coachingTip ? (
                  <div className="mock-live-room__reply-card">
                    <span className="mock-live-room__eyebrow">Live coaching</span>
                    <p>{answerSignal || "Your last answer is being assessed for clarity and depth."}</p>
                    <p>{coachingTip}</p>
                  </div>
                ) : null} */}

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${questionIndex}-${currentQuestion}`}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="mock-live-room__question-card"
                  >
                    <div className="mock-live-room__question-head">
                      <span className="mock-live-room__eyebrow">Current question</span>
                      <span className="mock-live-room__question-step">
                        Question {questionIndex}
                      </span>
                    </div>
                    <h2 className="mock-live-room__question-title">
                      {currentQuestion || "Waiting for the next question."}
                    </h2>
                  </motion.div>
                </AnimatePresence>

                {/* <div className="mock-live-room__prompt-meta">
                  <div className="mock-live-room__mini-stat">
                    <span>Status</span>
                    <strong>{interviewerStatus}</strong>
                  </div>
                  <div className="mock-live-room__mini-stat">
                    <span>Session</span>
                    <strong>
                      {formatLabel(initialSession.difficulty)} ·{" "}
                      {formatLabel(initialSession.englishLevel)}
                    </strong>
                  </div>
                  <div className="mock-live-room__mini-stat">
                    <span>Next step</span>
                    <strong>Listen, think, answer</strong>
                  </div>
                  {initialSession?.focusAreas?.length ? (
                    <div className="mock-live-room__mini-stat">
                      <span>Interview focus</span>
                      <strong>{initialSession.focusAreas.slice(0, 2).join(" · ")}</strong>
                    </div>
                  ) : null}
                </div> */}

                {/* {initialSession?.candidateBrief ? (
                  <div className="mock-live-room__reply-card">
                    <span className="mock-live-room__eyebrow">What this session is testing</span>
                    <p>{initialSession.candidateBrief}</p>
                  </div>
                ) : null} */}
              </div>
            </div>

            <div className="mock-live-room__stage-actions">
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                type="button"
                onClick={() => void speak(`${interviewerReply} ${currentQuestion}`)}
                className="mock-live-room__control"
              >
                <Volume2 size={16} />
                Replay Prompt
              </motion.button>

              <div className="mock-live-room__control is-muted mock-live-room__status-indicator">
                <motion.span
                  animate={{ opacity: [0.45, 1, 0.45], scale: [1, 1.35, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="mock-live-room__pulse-dot"
                />
                {interviewerStatus}
              </div>
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
            className="mock-surface mock-live-room__workspace"
          >
            <div className="mock-live-room__section-head">
              <div className="mock-live-room__section-title-wrap">
                <div className="mock-live-room__section-icon">
                  <Mic size={18} />
                </div>
                <div>
                  <p className="mock-section-kicker">Response Console</p>
                  <h1 className="mock-live-room__section-title">Answer Workspace</h1>
                  {/* <p className="mock-live-room__section-copy">
                    Draft, refine, and submit your response without losing sight of the live
                    interview flow.
                  </p> */}
                </div>
              </div>
              <span className="mock-live-room__role-badge">Answering</span>
            </div>

            <div className="mock-live-room__workspace-stats">
              <div className="mock-live-room__workspace-stat">
                <span className="mock-live-room__workspace-stat-icon">
                  <Clock3 size={22} />
                </span>
                <span>Progress</span>
                <strong>
                  {questionIndex}/{totalQuestionCount}
                </strong>
                <p>{questionProgressPercent}% through this session</p>
              </div>
              <div className="mock-live-room__workspace-stat">
                <span className="mock-live-room__workspace-stat-icon">
                  <FileText size={22} />
                </span>
                <span>Draft</span>
                <strong>{answerWordCount} words</strong>
                <p>{candidateStatus}</p>
              </div>
              <div className="mock-live-room__workspace-stat">
                <span className="mock-live-room__workspace-stat-icon">
                  <Mic size={22} />
                </span>
                <span>Input</span>
                <strong>{recognitionSupported ? candidateMode : "Typing only"}</strong>
                <p>Mic level {voiceMeterPercent}%</p>
              </div>
            </div>

            <label className="mock-live-room__composer">
              <div className="mock-live-room__composer-head">
                <span className="mock-field-label">Answer Draft</span>
                <span className="mock-live-room__composer-mode">{candidateStatus}</span>
              </div>
              <textarea
                value={draftAnswer}
                onChange={(event) => setDraftAnswer(event.target.value)}
                rows={7}
                className="textarea mock-answer-input mock-live-room__answer-input"
                placeholder="Speak or type your answer here..."
              />
            </label>

            {/* <p className="mock-live-room__workspace-note">{answerGuidance}</p> */}

            {/* <div className="mock-live-room__answer-rail">
              <div className="mock-live-room__answer-rail-item">
                <span className="mock-live-room__answer-rail-icon">
                  <FileText size={14} />
                </span>
                <span>Context</span>
              </div>
              <div className="mock-live-room__answer-rail-item">
                <span className="mock-live-room__answer-rail-icon">
                  <ArrowRight size={14} />
                </span>
                <span>Action</span>
              </div>
              <div className="mock-live-room__answer-rail-item">
                <span className="mock-live-room__answer-rail-icon">
                  <Target size={14} />
                </span>
                <span>Impact</span>
              </div>
            </div> */}

            {/* <div className="mock-live-room__compose-meta">
              <span>{answerWordCount} words drafted</span>
              <span>
                {recognitionSupported ? candidateMode : "Voice typing unavailable"}
              </span>
            </div> */}

            <div className="mock-live-room__control-row">
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`mock-live-room__control${isListening ? " is-recording" : ""}`}
              >
                {isListening ? (
                  <>
                    <MicOff size={16} />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic size={16} />
                    Record Answer
                  </>
                )}
              </motion.button>

              <motion.button
                whileHover={{ y: canSubmitAnswer ? -2 : 0 }}
                whileTap={{ scale: canSubmitAnswer ? 0.985 : 1 }}
                type="button"
                onClick={submitAnswer}
                disabled={!canSubmitAnswer}
                className="mock-live-room__control is-primary"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Submit Answer
                  </>
                )}
              </motion.button>
            </div>

          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
            className="mock-surface mock-live-room__studio"
          >
            <div className="mock-live-room__section-head">
              <div className="mock-live-room__section-title-wrap">
                <div className="mock-live-room__section-icon">
                  <Video size={18} />
                </div>
                <div>
                  <p className="mock-section-kicker">Candidate Studio</p>
                  <h1 className="mock-live-room__section-title">{candidateLabel}</h1>
                  {/* <p className="mock-live-room__section-copy">
                    Keep your framing clean, watch your audio level, and stay aware of any live
                    monitoring signals.
                  </p> */}
                </div>
              </div>
              <span className="mock-live-room__role-badge">Candidate</span>
            </div>

            <div className="mock-live-room__studio-frame">
              <video ref={videoRef} autoPlay muted playsInline className="mock-stage-video" />

              <div className="mock-live-room__video-topbar">
                <span className="mock-live-room__presence">
                  <span className="mock-live-room__presence-dot" />
                  Camera live
                </span>
                <span className="mock-live-room__video-badge">
                  {recognitionSupported ? candidateMode : "Typing mode"}
                </span>
              </div>

              <div className="mock-live-room__video-overlay">
                <div className="mock-live-room__video-identity">
                  <span className="mock-live-room__video-name">{candidateLabel}</span>
                  <span className="mock-live-room__video-caption">Live interview feed</span>
                </div>

                <div className="mock-live-room__meter-card">
                  <div className="mock-live-room__meter-head">
                    <span>Mic level</span>
                    <strong>{voiceMeterPercent}%</strong>
                  </div>
                  <div className="mock-live-room__meter-track">
                    <motion.div
                      animate={{ width: `${voiceMeterPercent}%` }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="mock-live-room__meter-fill"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mock-live-room__monitor-grid">
              {liveMonitorCards.map((card) => (
                <div key={card.label} className={`mock-live-room__monitor-card is-${card.tone}`}>
                  <div className="mock-live-room__monitor-card-head">
                    <span className="mock-live-room__monitor-card-icon">{card.icon}</span>
                    <span>{card.label}</span>
                  </div>
                  <strong>{card.value}</strong>
                  {/* <p>{card.hint}</p> */}
                </div>
              ))}
            </div>

            <div className="mock-live-room__signal-feed">
              <div className="mock-live-room__signal-feed-head">
                <strong>Live integrity feed</strong>
                <span>{flags.length ? `${flags.length} alert(s)` : "Clean session"}</span>
              </div>

              <div className="mock-live-room__signal-list">
                {recentFlags.length ? (
                  recentFlags.map((flag) => (
                    <div key={flag.id} className="mock-live-room__signal-item">
                      <div className="mock-live-room__signal-item-mark">
                        <ShieldAlert size={14} />
                      </div>
                      <div>
                        <p>{flag.message}</p>
                        <span>{flag.time}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="mock-live-room__signal-item is-clean">
                    <div className="mock-live-room__signal-item-mark">
                      <Activity size={14} />
                    </div>
                    <div>
                      <p>{latestSignalMessage}</p>
                      <span>Live monitoring active</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.article>
        </section>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
          className="mock-live-room__footer"
        >
          <div className="mock-live-room__footer-metrics">
            <span className="mock-chip">
              <Clock3 size={14} />
              {formatDuration(elapsedSeconds)}
            </span>
            <span className="mock-chip">
              <Activity size={14} />
              {answerWordCount} words
            </span>
            <span className="mock-chip">
              <ShieldAlert size={14} />
              Alerts {flags.length}
            </span>
            <span className="mock-chip mock-chip--wide" title={recentFlags[0]?.message || ""}>
              {recentFlags[0] ? recentFlags[0].message : "No live alerts"}
            </span>
          </div>

          <motion.button
            whileHover={{ y: isSubmitting || isFinishing ? 0 : -2 }}
            whileTap={{ scale: isSubmitting || isFinishing ? 1 : 0.985 }}
            type="button"
            onClick={() => void exitInterview()}
            disabled={isSubmitting || isFinishing}
            className="mock-live-room__end"
          >
            {isFinishing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Ending Interview...
              </>
            ) : (
              "End Interview"
            )}
          </motion.button>
        </motion.div>

      </div>
    </div>
  );
}
