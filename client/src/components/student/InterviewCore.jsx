import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  ShieldAlert,
  Volume2,
} from "lucide-react";

import {
  continueMockInterview,
  finishMockInterview,
} from "../../services/interviewQaApi.jsx";


const formatDuration = (seconds = 0) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function InterviewCore({
  initialSession,
  mediaStream,
  onRestart,
}) {
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const cooldownRef = useRef({});
  const timerRef = useRef(null);
  const monitorRef = useRef(null);

  const [currentQuestion, setCurrentQuestion] = useState(initialSession.question || "");
  const [interviewerReply, setInterviewerReply] = useState(initialSession.opening || "");
  const [history, setHistory] = useState([]);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [questionIndex, setQuestionIndex] = useState(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState(initialSession.warning || "");
  const [summary, setSummary] = useState(null);
  const [flags, setFlags] = useState([]);
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

  const pushFlag = (message, key, wait = 18000) => {
    const now = Date.now();
    if (cooldownRef.current[key] && now - cooldownRef.current[key] < wait) return;
    cooldownRef.current[key] = now;
    setFlags((previous) => [
      { id: `${key}-${now}`, message, time: new Date(now).toLocaleTimeString() },
      ...previous,
    ].slice(0, 12));
  };

  const speak = (text) => {
    if (!window.speechSynthesis || !text?.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
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

  const buildSummary = async (nextHistory, closingRemark = "", warningMessage = "") => {
    try {
      setIsFinishing(true);
      const data = await finishMockInterview({
        history: nextHistory,
        role: initialSession.role,
        difficulty: initialSession.difficulty,
        englishLevel: initialSession.englishLevel,
        totalQuestions: initialSession.totalQuestions,
        resumeSummary: initialSession.profile?.resumeSummary || "",
        resumeSkills: initialSession.profile?.resumeSkills || [],
        skills: initialSession.profile?.skills || [],
        proctorFlags: flags.map((item) => item.message),
      });

      setSummary({
        summary: data?.summary || "",
        strengths: Array.isArray(data?.strengths) ? data.strengths : [],
        improvements: Array.isArray(data?.improvements) ? data.improvements : [],
        overallScore: Number(data?.overallScore ?? 0) || 0,
        communicationScore: Number(data?.communicationScore ?? 0) || 0,
        technicalScore: Number(data?.technicalScore ?? 0) || 0,
        confidenceScore: Number(data?.confidenceScore ?? 0) || 0,
        integrityNote: data?.integrityNote || "",
        closingRemark,
      });

      if (warningMessage || data?.warning) setNotice(warningMessage || data.warning);
      if (closingRemark) speak(closingRemark);
    } catch (error) {
      setPageError(error?.response?.data?.message || "Unable to finish the interview.");
    } finally {
      setIsFinishing(false);
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
      if (data?.warning) setNotice(data.warning);

      if (data?.shouldEnd || !data?.question) {
        await buildSummary(nextHistory, data?.closingRemark || "", data?.warning || "");
        return;
      }

      setCurrentQuestion(data.question);
      setQuestionIndex((previous) => previous + 1);
      speak(`${data?.interviewerReply || ""} ${data?.question || ""}`);
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
    speak(`${initialSession.opening || ""} ${initialSession.question || ""}`);
    return () => {
      window.speechSynthesis?.cancel?.();
      stopListening();
    };
  }, [initialSession.opening, initialSession.question]);

  useEffect(() => {
    if (summary) return undefined;
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((previous) => previous + 1);
    }, 1000);
    return () => window.clearInterval(timerRef.current);
  }, [summary]);

  useEffect(() => {
    if (summary) return undefined;

    const onHide = () => document.hidden && pushFlag("Interview tab was hidden.", "tab-hide");
    const onBlur = () => pushFlag("Window focus left the interview screen.", "blur");
    const onFull = () => !document.fullscreenElement && pushFlag("Fullscreen mode was exited.", "fullscreen");
    const onBlocked = (event) => {
      event.preventDefault();
      pushFlag(`${event.type} action was blocked during the interview.`, event.type);
    };
    const onKey = (event) => {
      const loweredKey = String(event.key || "").toLowerCase();
      if (
        event.key === "F12" ||
        ((event.ctrlKey || event.metaKey) && ["c", "v", "x", "t", "w", "n", "i", "j"].includes(loweredKey))
      ) {
        event.preventDefault();
        pushFlag(`Shortcut ${event.key} was attempted during the interview.`, `shortcut-${loweredKey || "f12"}`);
      }
    };

    document.addEventListener("visibilitychange", onHide);
    document.addEventListener("fullscreenchange", onFull);
    document.addEventListener("copy", onBlocked);
    document.addEventListener("paste", onBlocked);
    document.addEventListener("cut", onBlocked);
    document.addEventListener("contextmenu", onBlocked);
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("visibilitychange", onHide);
      document.removeEventListener("fullscreenchange", onFull);
      document.removeEventListener("copy", onBlocked);
      document.removeEventListener("paste", onBlocked);
      document.removeEventListener("cut", onBlocked);
      document.removeEventListener("contextmenu", onBlocked);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
    };
  }, [summary]);

  useEffect(() => {
    if (summary || !mediaStream) return undefined;

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

      if (brightness < 22) pushFlag("Camera feed looks too dark or obstructed.", "dark-camera", 22000);
      if (motion > 70) pushFlag("Excessive movement was detected in frame.", "camera-motion", 22000);

      if (detector) {
        try {
          const faces = await detector.detect(video);
          setCameraState((previous) => ({ ...previous, faceCount: faces.length }));
          if (faces.length === 0) pushFlag("Face not detected in camera frame.", "no-face", 22000);
          if (faces.length > 1) pushFlag("Multiple faces detected in camera frame.", "multi-face", 22000);
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
  }, [mediaStream, summary]);

  return (
    <div className="page-shell">
      <div className="page-inner max-w-[1440px] space-y-6">
        <section className="glass-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Live Interview</p>
              <h1 className="section-title">Resume-aware interviewer flow with follow-up questions and integrity tracking.</h1>
              <p className="text-sm leading-7 text-slate-300">
                {initialSession.role} · {initialSession.englishLevel} English · {initialSession.difficulty} difficulty · Question {questionIndex} of {initialSession.totalQuestions}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="badge">{formatDuration(elapsedSeconds)}</span>
              <span className="badge">{flags.length} signal{flags.length === 1 ? "" : "s"}</span>
              <button type="button" onClick={() => speak(`${interviewerReply} ${currentQuestion}`)} className="btn-ghost">
                <Volume2 size={16} />
                Replay
              </button>
            </div>
          </div>
          {pageError ? <p className="mt-4 rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{pageError}</p> : null}
          {notice ? <p className="mt-4 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{notice}</p> : null}
        </section>
        <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="glass-card p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Camera</p>
              <h2 className="mt-1 font-['Sora'] text-lg font-semibold text-slate-50">Live preview</h2>
              <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/40">
                <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full bg-slate-950 object-cover" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  Brightness: <span className="font-semibold text-slate-100">{cameraState.brightness}</span>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  Motion: <span className="font-semibold text-slate-100">{cameraState.motion}</span>
                </div>
              </div>
              {cameraState.mode === "face" ? (
                <div className="mt-3 rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  Face count detected: <span className="font-semibold text-slate-100">{cameraState.faceCount ?? 0}</span>
                </div>
              ) : null}
            </section>

            <section className="glass-card p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Integrity Log</p>
              <h2 className="mt-1 font-['Sora'] text-lg font-semibold text-slate-50">Proctoring signals</h2>
              <div className="mt-4 space-y-3">
                {flags.length ? flags.map((item) => (
                  <div key={item.id} className="rounded-[18px] border border-amber-300/20 bg-amber-400/8 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <ShieldAlert size={16} className="mt-1 text-amber-200" />
                      <div>
                        <p className="text-sm text-amber-50">{item.message}</p>
                        <p className="mt-1 text-xs text-amber-100/70">{item.time}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[18px] border border-emerald-300/20 bg-emerald-400/10 px-4 py-4 text-sm leading-7 text-emerald-50">
                    No integrity signals yet. Stay in fullscreen, keep your face visible, and continue naturally.
                  </div>
                )}
              </div>
            </section>
          </aside>

          <div className="space-y-6">
            <section className="glass-card p-6">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Interviewer</p>
              <div className="mt-4 rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-100">
                {interviewerReply || "The interviewer reply will appear here."}
              </div>
              <div className="mt-4 rounded-[22px] border border-cyan-300/20 bg-cyan-400/8 p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-100/80">Current Question</p>
                <h2 className="mt-3 font-['Sora'] text-2xl font-semibold leading-tight text-cyan-50">{currentQuestion}</h2>
              </div>

              {!summary ? (
                <div className="mt-4 rounded-[22px] border border-white/10 bg-slate-950/25 p-5">
                  <label className="block">
                    <span className="input-label">Your Answer</span>
                    <textarea
                      value={draftAnswer}
                      onChange={(event) => setDraftAnswer(event.target.value)}
                      rows={10}
                      className="textarea min-h-[220px] resize-y"
                      placeholder="Speak or type your answer here..."
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={isListening ? stopListening : startListening} className="btn-secondary">
                      {isListening ? <><MicOff size={16} />Stop Voice Input</> : <><Mic size={16} />Start Voice Input</>}
                    </button>
                    <button type="button" onClick={submitAnswer} disabled={isSubmitting || isFinishing} className="btn-primary">
                      {isSubmitting ? <><Loader2 size={16} className="animate-spin" />Next Question...</> : <><Send size={16} />Submit Answer</>}
                    </button>
                    <button
                      type="button"
                      onClick={() => history.length && buildSummary(history, "Thanks, we will stop here and move to your interview summary.")}
                      disabled={!history.length || isSubmitting || isFinishing}
                      className="btn-ghost"
                    >
                      {isFinishing ? <><Loader2 size={16} className="animate-spin" />Finishing...</> : "End Interview"}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="glass-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Transcript</p>
                  <h2 className="mt-1 font-['Sora'] text-lg font-semibold text-slate-50">Answered questions</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{history.length} answered</span>
              </div>
              <div className="mt-4 space-y-4">
                {history.length ? history.map((item, index) => (
                  <div key={`${item.question}-${index}`} className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                    <span className="badge">Question {index + 1}</span>
                    <p className="mt-4 text-sm font-semibold leading-7 text-slate-100">{item.question}</p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{item.answer}</p>
                    {item.interviewerReply ? (
                      <div className="mt-4 rounded-[18px] border border-white/10 bg-slate-950/25 p-4 text-sm leading-7 text-slate-200">
                        {item.interviewerReply}
                      </div>
                    ) : null}
                  </div>
                )) : (
                  <div className="rounded-[22px] border border-dashed border-white/14 bg-white/4 px-6 py-10 text-sm leading-7 text-slate-400">
                    Your question-and-answer history will appear here after each submitted response.
                  </div>
                )}
              </div>
            </section>

            {summary ? (
              <section className="glass-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Interview Summary</p>
                    <h2 className="mt-1 font-['Sora'] text-2xl font-semibold text-slate-50">Debrief and scoring</h2>
                  </div>
                  <button type="button" onClick={onRestart} className="btn-secondary">
                    <RotateCcw size={16} />
                    Back To Setup
                  </button>
                </div>

                {summary.closingRemark ? (
                  <div className="mt-5 rounded-[20px] border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm leading-7 text-cyan-50">
                    {summary.closingRemark}
                  </div>
                ) : null}

                <div className="mt-5 rounded-[22px] border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-100">
                  {summary.summary}
                  {summary.integrityNote ? (
                    <p className="mt-4 rounded-[18px] border border-amber-300/20 bg-amber-400/8 px-4 py-3 text-sm text-amber-50">
                      {summary.integrityNote}
                    </p>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-4">
                  <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Overall: <span className="font-semibold text-slate-100">{summary.overallScore}/100</span></div>
                  <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Communication: <span className="font-semibold text-slate-100">{summary.communicationScore}/100</span></div>
                  <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Technical: <span className="font-semibold text-slate-100">{summary.technicalScore}/100</span></div>
                  <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Confidence: <span className="font-semibold text-slate-100">{summary.confidenceScore}/100</span></div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[22px] border border-emerald-300/20 bg-emerald-400/8 p-5">
                    <p className="text-sm font-semibold text-emerald-50">Strengths</p>
                    <div className="mt-4 space-y-3">
                      {(summary.strengths || []).map((item) => (
                        <div key={item} className="rounded-[18px] border border-white/10 bg-slate-950/25 px-4 py-3 text-sm leading-7 text-slate-100">{item}</div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-rose-300/20 bg-rose-400/8 p-5">
                    <p className="text-sm font-semibold text-rose-50">Improvements</p>
                    <div className="mt-4 space-y-3">
                      {(summary.improvements || []).map((item) => (
                        <div key={item} className="rounded-[18px] border border-white/10 bg-slate-950/25 px-4 py-3 text-sm leading-7 text-slate-100">{item}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
